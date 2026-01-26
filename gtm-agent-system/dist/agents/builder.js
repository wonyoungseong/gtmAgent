"use strict";
/**
 * Builder Agent
 * Target 워크스페이스에 엔티티 생성
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuilderAgent = void 0;
const gtm_agent_skills_1 = require("gtm-agent-skills");
const base_1 = require("./base");
const error_1 = require("../utils/error");
// ==================== Rate Limiting Constants ====================
/**
 * GTM API Rate Limit: 15 requests per minute (0.25 QPS)
 * We use conservative settings to avoid quota exhaustion
 */
const RATE_LIMIT = {
    // Delay between entity creations (milliseconds) - 4 seconds = 15 req/min
    ENTITY_DELAY_MS: 4000,
    // Maximum retry attempts for rate limit errors
    MAX_RETRIES: 3,
    // Base delay for exponential backoff (milliseconds)
    BACKOFF_BASE_MS: 1000,
    // Maximum delay for exponential backoff (milliseconds) - 60 seconds
    BACKOFF_MAX_MS: 60000,
};
// ==================== Builder Agent ====================
class BuilderAgent extends base_1.BaseAgent {
    constructor() {
        super('builder');
        this.idMapper = new gtm_agent_skills_1.IdMapper();
    }
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Calculate exponential backoff delay
     */
    calculateBackoffDelay(attempt) {
        const delay = RATE_LIMIT.BACKOFF_BASE_MS * Math.pow(2, attempt);
        return Math.min(delay, RATE_LIMIT.BACKOFF_MAX_MS);
    }
    /**
     * Check if error is a rate limit error
     */
    isRateLimitError(errorMsg) {
        const rateLimitPatterns = [
            '429',
            'rate limit',
            'rate_limit',
            'rateLimit',
            'quota',
            'too many requests',
            'exceeded',
            '403' // Sometimes quota errors return 403
        ];
        const lowerMsg = errorMsg.toLowerCase();
        return rateLimitPatterns.some(pattern => lowerMsg.includes(pattern.toLowerCase()));
    }
    /**
     * Create entity with automatic retry for rate limit errors
     */
    async createEntityWithRetry(step, newName, transformer) {
        let lastError = null;
        for (let attempt = 0; attempt < RATE_LIMIT.MAX_RETRIES; attempt++) {
            try {
                return await this.createEntity(step, newName, transformer);
            }
            catch (error) {
                lastError = error;
                const errorMsg = error instanceof Error ? error.message : String(error);
                if (this.isRateLimitError(errorMsg)) {
                    if (attempt < RATE_LIMIT.MAX_RETRIES - 1) {
                        const backoffDelay = this.calculateBackoffDelay(attempt);
                        this.logger.warn(`Rate limit hit, retrying in ${backoffDelay}ms`, {
                            attempt: attempt + 1,
                            maxRetries: RATE_LIMIT.MAX_RETRIES,
                            entityType: step.type,
                            entityName: newName
                        });
                        await this.delay(backoffDelay);
                        continue;
                    }
                }
                // Non-rate-limit error or max retries reached
                throw error;
            }
        }
        // This should not be reached, but TypeScript needs it
        throw lastError || new Error('Unknown error during entity creation');
    }
    /**
     * 요청 처리
     */
    async execute(request) {
        this.validateContext();
        switch (request.action) {
            case 'build':
                return this.build(request.data);
            case 'buildSingle':
                return this.buildSingle(request.data);
            case 'rollback':
                return this.rollback(request.data);
            default:
                throw new Error(`Unknown action: ${request.action}`);
        }
    }
    /**
     * 생성 계획 실행
     */
    async build(request) {
        return this.safeExecute({ action: 'build', data: request, context: this.context }, async () => {
            const { creationPlan, nameMap, dryRun } = request;
            this.idMapper.clear();
            const createdEntities = [];
            const errors = [];
            let skippedCount = 0;
            let rollbackResult;
            const transformer = new gtm_agent_skills_1.ConfigTransformer(this.idMapper);
            const totalSteps = creationPlan.steps.filter(s => s.action === 'CREATE').length;
            let currentStep = 0;
            this.logger.info('=== BUILD PHASE STARTED ===', {
                totalSteps,
                dryRun: dryRun || false,
                rateLimitDelayMs: RATE_LIMIT.ENTITY_DELAY_MS,
                maxRetries: RATE_LIMIT.MAX_RETRIES,
                warnings: creationPlan.warnings,
                stepsToCreate: creationPlan.steps.filter(s => s.action === 'CREATE').map(s => ({ type: s.type, name: s.newName })),
                stepsToSkip: creationPlan.steps.filter(s => s.action === 'SKIP').map(s => ({ type: s.type, name: s.newName }))
            });
            let isFirstCreate = true;
            for (const step of creationPlan.steps) {
                if (step.action === 'SKIP') {
                    skippedCount++;
                    // SKIP된 엔티티도 ID 매핑에 추가 (target에 이미 존재하는 엔티티의 ID)
                    if (step.targetId) {
                        this.idMapper.add(step.originalId, step.targetId, step.type, step.newName);
                        this.logger.info(`SKIP+MAP: ${step.type} "${step.newName}" - mapped ${step.originalId} -> ${step.targetId}`);
                        // Template SKIP: cvt type 매핑 등록
                        if (step.type === gtm_agent_skills_1.EntityType.TEMPLATE) {
                            const sourceContainerId = this.context.sourceWorkspace.containerId;
                            const targetContainerId = this.context.targetWorkspace.containerId;
                            const targetCvtType = `cvt_${targetContainerId}_${step.targetId}`;
                            // 1. Container-specific type mapping
                            const sourceCvtType = `cvt_${sourceContainerId}_${step.originalId}`;
                            if (sourceCvtType !== targetCvtType) {
                                this.idMapper.addTemplateTypeMapping(sourceCvtType, targetCvtType);
                                this.logger.info('Template type mapping (SKIP/container)', {
                                    originalType: sourceCvtType, newType: targetCvtType
                                });
                            }
                            // 2. Gallery ID mapping
                            if (step.config?.templateData) {
                                const galleryCvtMatch = step.config.templateData.match(/"id":\s*"(cvt_[^"]+)"/);
                                if (galleryCvtMatch && galleryCvtMatch[1] !== 'cvt_temp_public_id' && galleryCvtMatch[1] !== targetCvtType) {
                                    this.idMapper.addTemplateTypeMapping(galleryCvtMatch[1], targetCvtType);
                                    this.logger.info('Template type mapping (SKIP/gallery)', {
                                        originalType: galleryCvtMatch[1], newType: targetCvtType
                                    });
                                }
                            }
                        }
                    }
                    else {
                        this.logger.warn(`SKIP (no target ID): ${step.type} "${step.newName}" - cannot map ID`);
                    }
                    continue;
                }
                currentStep++;
                this.reportProgress(currentStep, totalSteps, `Creating ${step.type}: ${step.newName}`);
                if (dryRun) {
                    this.logger.info('DRY RUN: would create', {
                        type: step.type,
                        name: step.newName,
                        originalId: step.originalId
                    });
                    continue;
                }
                // Rate limiting: delay between entity creations (except first one)
                if (!isFirstCreate) {
                    this.logger.debug(`Rate limiting: waiting ${RATE_LIMIT.ENTITY_DELAY_MS}ms before next creation`);
                    await this.delay(RATE_LIMIT.ENTITY_DELAY_MS);
                }
                isFirstCreate = false;
                this.logger.info(`CREATING [${currentStep}/${totalSteps}]: ${step.type} "${step.newName}"`);
                try {
                    const newName = nameMap?.get(step.originalId) || step.newName;
                    // Use createEntityWithRetry for automatic retry on rate limit errors
                    const entity = await this.createEntityWithRetry(step, newName, transformer);
                    createdEntities.push(entity);
                    this.idMapper.add(step.originalId, entity.newId, step.type, entity.name);
                    this.logger.info(`SUCCESS: ${step.type} created`, {
                        originalId: step.originalId,
                        newId: entity.newId,
                        name: entity.name
                    });
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    const isRateLimit = this.isRateLimitError(errorMsg);
                    const isDuplicate = errorMsg.includes('duplicate') || errorMsg.includes('already exists');
                    errors.push({
                        entityId: step.originalId,
                        entityName: step.newName,
                        error: errorMsg
                    });
                    this.logger.error(`FAILED: ${step.type} "${step.newName}"`, {
                        error: errorMsg,
                        isRateLimit,
                        isDuplicate,
                        retriesExhausted: isRateLimit, // If rate limit error reached here, retries are exhausted
                        stack: error?.stack,
                        step: currentStep,
                        totalSteps
                    });
                    // Rate limit 에러면 즉시 중단 (retries already exhausted)
                    if (isRateLimit) {
                        this.logger.error('=== BUILD ABORTED: API Rate Limit (retries exhausted) ===');
                        break;
                    }
                    // 롤백 필요 여부 판단
                    if (createdEntities.length > 0) {
                        this.logger.warn('Rolling back created entities due to error', {
                            createdCount: createdEntities.length
                        });
                        rollbackResult = await this.performRollback(createdEntities);
                        // Clear created entities after rollback (they've been deleted)
                        createdEntities.length = 0;
                        break;
                    }
                }
            }
            const hasErrors = errors.length > 0;
            const hasCreatedEntities = createdEntities.length > 0;
            const partialSuccess = hasErrors && hasCreatedEntities;
            this.logger.info('=== BUILD PHASE COMPLETED ===', {
                success: !hasErrors,
                partialSuccess,
                createdCount: createdEntities.length,
                skippedCount,
                errorCount: errors.length,
                rollbackPerformed: !!rollbackResult,
                rollbackResult: rollbackResult ? {
                    attempted: rollbackResult.attempted,
                    succeeded: rollbackResult.succeeded,
                    failed: rollbackResult.failed.length
                } : undefined,
                errors: errors.map(e => ({ entity: e.entityName, error: e.error }))
            });
            return {
                success: !hasErrors,
                partialSuccess,
                createdEntities,
                idMapping: this.idMapper.getAll(),
                skippedCount,
                errors,
                rollbackResult
            };
        });
    }
    /**
     * 단일 엔티티 생성
     */
    async buildSingle(request) {
        return this.safeExecute({ action: 'buildSingle', data: request, context: this.context }, async () => {
            const { entityType, sourceEntity, newName } = request;
            const transformer = new gtm_agent_skills_1.ConfigTransformer(this.idMapper);
            const finalName = newName || sourceEntity.name;
            // 중복 검사
            const existing = await this.checkDuplicate(entityType, finalName);
            if (existing) {
                throw new error_1.DuplicateNameError(entityType, finalName);
            }
            let config;
            let result;
            switch (entityType) {
                case gtm_agent_skills_1.EntityType.VARIABLE:
                    config = transformer.transformVariable(sourceEntity, { newName: finalName });
                    result = await this.mcp.createVariable(config);
                    return {
                        type: gtm_agent_skills_1.EntityType.VARIABLE,
                        originalId: sourceEntity.variableId,
                        newId: result.variableId,
                        name: result.name
                    };
                case gtm_agent_skills_1.EntityType.TRIGGER:
                    config = transformer.transformTrigger(sourceEntity, { newName: finalName });
                    result = await this.mcp.createTrigger(config);
                    return {
                        type: gtm_agent_skills_1.EntityType.TRIGGER,
                        originalId: sourceEntity.triggerId,
                        newId: result.triggerId,
                        name: result.name
                    };
                case gtm_agent_skills_1.EntityType.TAG:
                    config = transformer.transformTag(sourceEntity, { newName: finalName });
                    result = await this.mcp.createTag(config);
                    return {
                        type: gtm_agent_skills_1.EntityType.TAG,
                        originalId: sourceEntity.tagId,
                        newId: result.tagId,
                        name: result.name
                    };
                default:
                    throw new Error(`Unsupported entity type: ${entityType}`);
            }
        });
    }
    /**
     * 롤백 실행
     */
    async rollback(request) {
        return this.safeExecute({ action: 'rollback', data: request, context: this.context }, async () => {
            return await this.performRollback(request.createdEntities);
        });
    }
    /**
     * 엔티티 생성
     */
    async createEntity(step, newName, transformer) {
        // 중복 검사 (템플릿은 별도 처리)
        if (step.type !== gtm_agent_skills_1.EntityType.TEMPLATE) {
            const existing = await this.checkDuplicate(step.type, newName);
            if (existing) {
                throw new error_1.DuplicateNameError(step.type, newName);
            }
        }
        let result;
        switch (step.type) {
            case gtm_agent_skills_1.EntityType.TEMPLATE:
                // 템플릿 중복 검사
                if (typeof this.mcp.findTemplateByName === 'function') {
                    const existingTemplate = await this.mcp.findTemplateByName(newName);
                    if (existingTemplate) {
                        throw new error_1.DuplicateNameError(step.type, newName);
                    }
                }
                // templateData는 그대로 복사 (LLM 분석 불필요)
                const templateConfig = {
                    name: newName,
                    templateData: step.config.templateData
                    // galleryReference는 복사하지 않음 (새 템플릿으로 생성)
                };
                if (typeof this.mcp.createTemplate !== 'function') {
                    throw new error_1.CreationError(step.type, newName, 'Template creation not supported by MCP adapter');
                }
                result = await this.mcp.createTemplate(templateConfig);
                // cvt type 매핑 등록: cvt_<sourceContainerId>_<sourceTemplateId> → cvt_<targetContainerId>_<newTemplateId>
                {
                    const sourceContainerId = this.context.sourceWorkspace.containerId;
                    const targetContainerId = this.context.targetWorkspace.containerId;
                    const targetCvtType = `cvt_${targetContainerId}_${result.templateId}`;
                    // 1. Container-specific type mapping (cvt_172990757_195 → cvt_210926331_XX)
                    const sourceCvtType = `cvt_${sourceContainerId}_${step.originalId}`;
                    if (sourceCvtType !== targetCvtType) {
                        this.idMapper.addTemplateTypeMapping(sourceCvtType, targetCvtType);
                        this.logger.info('Template type mapping registered (CREATE/container)', {
                            originalType: sourceCvtType, newType: targetCvtType
                        });
                    }
                    // 2. Gallery ID mapping (cvt_KDDGR → cvt_210926331_XX)
                    if (step.config.templateData) {
                        const galleryCvtMatch = step.config.templateData.match(/"id":\s*"(cvt_[^"]+)"/);
                        if (galleryCvtMatch && galleryCvtMatch[1] !== 'cvt_temp_public_id' && galleryCvtMatch[1] !== targetCvtType) {
                            this.idMapper.addTemplateTypeMapping(galleryCvtMatch[1], targetCvtType);
                            this.logger.info('Template type mapping registered (CREATE/gallery)', {
                                originalType: galleryCvtMatch[1], newType: targetCvtType
                            });
                        }
                    }
                }
                return {
                    type: gtm_agent_skills_1.EntityType.TEMPLATE,
                    originalId: step.originalId,
                    newId: result.templateId,
                    name: result.name
                };
            case gtm_agent_skills_1.EntityType.VARIABLE:
                const varConfig = transformer.transformVariable(step.config, { newName });
                result = await this.mcp.createVariable(varConfig);
                return {
                    type: gtm_agent_skills_1.EntityType.VARIABLE,
                    originalId: step.originalId,
                    newId: result.variableId,
                    name: result.name
                };
            case gtm_agent_skills_1.EntityType.TRIGGER:
                const triggerConfig = transformer.transformTrigger(step.config, { newName });
                result = await this.mcp.createTrigger(triggerConfig);
                return {
                    type: gtm_agent_skills_1.EntityType.TRIGGER,
                    originalId: step.originalId,
                    newId: result.triggerId,
                    name: result.name
                };
            case gtm_agent_skills_1.EntityType.TAG:
                const tagConfig = transformer.transformTag(step.config, { newName });
                result = await this.mcp.createTag(tagConfig);
                return {
                    type: gtm_agent_skills_1.EntityType.TAG,
                    originalId: step.originalId,
                    newId: result.tagId,
                    name: result.name
                };
            default:
                throw new error_1.CreationError(step.type, newName, 'Unsupported entity type');
        }
    }
    /**
     * 중복 검사
     */
    async checkDuplicate(entityType, name) {
        switch (entityType) {
            case gtm_agent_skills_1.EntityType.TAG:
                return !!(await this.mcp.findTagByName(name));
            case gtm_agent_skills_1.EntityType.TRIGGER:
                return !!(await this.mcp.findTriggerByName(name));
            case gtm_agent_skills_1.EntityType.VARIABLE:
                return !!(await this.mcp.findVariableByName(name));
            case gtm_agent_skills_1.EntityType.TEMPLATE:
                if (typeof this.mcp.findTemplateByName === 'function') {
                    return !!(await this.mcp.findTemplateByName(name));
                }
                return false;
            default:
                return false;
        }
    }
    /**
     * 롤백 수행 (with detailed result tracking)
     */
    async performRollback(entities) {
        const result = {
            attempted: entities.length,
            succeeded: 0,
            failed: [],
            isPartial: false
        };
        // 역순으로 삭제 (의존성 순서)
        const reversed = [...entities].reverse();
        for (const entity of reversed) {
            try {
                switch (entity.type) {
                    case gtm_agent_skills_1.EntityType.TAG:
                        await this.mcp.deleteTag(entity.newId);
                        break;
                    case gtm_agent_skills_1.EntityType.TRIGGER:
                        await this.mcp.deleteTrigger(entity.newId);
                        break;
                    case gtm_agent_skills_1.EntityType.VARIABLE:
                        await this.mcp.deleteVariable(entity.newId);
                        break;
                    case gtm_agent_skills_1.EntityType.TEMPLATE:
                        if (typeof this.mcp.deleteTemplate === 'function') {
                            await this.mcp.deleteTemplate(entity.newId);
                        }
                        break;
                }
                result.succeeded++;
                this.logger.info('Rolled back entity', { id: entity.newId, type: entity.type, name: entity.name });
            }
            catch (error) {
                result.failed.push({
                    entityId: entity.newId,
                    entityType: entity.type,
                    error: error?.message || String(error)
                });
                this.logger.error('Failed to rollback entity', { entity, error: error?.message });
            }
        }
        result.isPartial = result.failed.length > 0;
        if (result.isPartial) {
            this.logger.warn('Partial rollback completed', {
                attempted: result.attempted,
                succeeded: result.succeeded,
                failed: result.failed.length,
                remainingEntities: result.failed.map(f => `${f.entityType}:${f.entityId}`)
            });
        }
        else {
            this.logger.info('Full rollback completed', {
                attempted: result.attempted,
                succeeded: result.succeeded
            });
        }
        return result;
    }
    /**
     * ID Mapper 반환
     */
    getIdMapper() {
        return this.idMapper;
    }
    /**
     * ID Mapper 초기화
     */
    resetIdMapper() {
        this.idMapper.clear();
    }
}
exports.BuilderAgent = BuilderAgent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hZ2VudHMvYnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFFSCx1REFhMEI7QUFDMUIsaUNBQW1DO0FBR25DLDBDQUFtRTtBQTBCbkUsb0VBQW9FO0FBRXBFOzs7R0FHRztBQUNILE1BQU0sVUFBVSxHQUFHO0lBQ2pCLHlFQUF5RTtJQUN6RSxlQUFlLEVBQUUsSUFBSTtJQUNyQiwrQ0FBK0M7SUFDL0MsV0FBVyxFQUFFLENBQUM7SUFDZCxvREFBb0Q7SUFDcEQsZUFBZSxFQUFFLElBQUk7SUFDckIsb0VBQW9FO0lBQ3BFLGNBQWMsRUFBRSxLQUFLO0NBQ3RCLENBQUM7QUFFRiwwREFBMEQ7QUFFMUQsTUFBYSxZQUFhLFNBQVEsZ0JBQVM7SUFHekM7UUFDRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLDJCQUFRLEVBQUUsQ0FBQztJQUNqQyxDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsRUFBVTtRQUN0QixPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3pELENBQUM7SUFFRDs7T0FFRztJQUNLLHFCQUFxQixDQUFDLE9BQWU7UUFDM0MsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNoRSxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxnQkFBZ0IsQ0FBQyxRQUFnQjtRQUN2QyxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLEtBQUs7WUFDTCxZQUFZO1lBQ1osWUFBWTtZQUNaLFdBQVc7WUFDWCxPQUFPO1lBQ1AsbUJBQW1CO1lBQ25CLFVBQVU7WUFDVixLQUFLLENBQUUsb0NBQW9DO1NBQzVDLENBQUM7UUFDRixNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDeEMsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDckYsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLHFCQUFxQixDQUNqQyxJQUFrQixFQUNsQixPQUFlLEVBQ2YsV0FBOEI7UUFFOUIsSUFBSSxTQUFTLEdBQWlCLElBQUksQ0FBQztRQUVuQyxLQUFLLElBQUksT0FBTyxHQUFHLENBQUMsRUFBRSxPQUFPLEdBQUcsVUFBVSxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUFDO1lBQ2xFLElBQUksQ0FBQztnQkFDSCxPQUFPLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQzdELENBQUM7WUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO2dCQUNwQixTQUFTLEdBQUcsS0FBSyxDQUFDO2dCQUNsQixNQUFNLFFBQVEsR0FBRyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBRXhFLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7b0JBQ3BDLElBQUksT0FBTyxHQUFHLFVBQVUsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxFQUFFLENBQUM7d0JBQ3pDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDekQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsK0JBQStCLFlBQVksSUFBSSxFQUFFOzRCQUNoRSxPQUFPLEVBQUUsT0FBTyxHQUFHLENBQUM7NEJBQ3BCLFVBQVUsRUFBRSxVQUFVLENBQUMsV0FBVzs0QkFDbEMsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJOzRCQUNyQixVQUFVLEVBQUUsT0FBTzt5QkFDcEIsQ0FBQyxDQUFDO3dCQUNILE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQzt3QkFDL0IsU0FBUztvQkFDWCxDQUFDO2dCQUNILENBQUM7Z0JBRUQsOENBQThDO2dCQUM5QyxNQUFNLEtBQUssQ0FBQztZQUNkLENBQUM7UUFDSCxDQUFDO1FBRUQsc0RBQXNEO1FBQ3RELE1BQU0sU0FBUyxJQUFJLElBQUksS0FBSyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE9BQU8sQ0FBTyxPQUF3QjtRQUMxQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFdkIsUUFBUSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDdkIsS0FBSyxPQUFPO2dCQUNWLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBb0IsQ0FBOEIsQ0FBQztZQUUvRSxLQUFLLGFBQWE7Z0JBQ2hCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBMEIsQ0FBOEIsQ0FBQztZQUUzRixLQUFLLFVBQVU7Z0JBQ2IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUE0QyxDQUE4QixDQUFDO1lBRTFHO2dCQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQXFCO1FBQ3ZDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FDckIsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFRLEVBQUUsRUFDMUQsS0FBSyxJQUFJLEVBQUU7WUFDVCxNQUFNLEVBQUUsWUFBWSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsR0FBRyxPQUFPLENBQUM7WUFDbEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUV0QixNQUFNLGVBQWUsR0FBb0IsRUFBRSxDQUFDO1lBQzVDLE1BQU0sTUFBTSxHQUFtRSxFQUFFLENBQUM7WUFDbEYsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO1lBQ3JCLElBQUksY0FBMEMsQ0FBQztZQUUvQyxNQUFNLFdBQVcsR0FBRyxJQUFJLG9DQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN6RCxNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ2hGLElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztZQUVwQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyw2QkFBNkIsRUFBRTtnQkFDOUMsVUFBVTtnQkFDVixNQUFNLEVBQUUsTUFBTSxJQUFJLEtBQUs7Z0JBQ3ZCLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxlQUFlO2dCQUM1QyxVQUFVLEVBQUUsVUFBVSxDQUFDLFdBQVc7Z0JBQ2xDLFFBQVEsRUFBRSxZQUFZLENBQUMsUUFBUTtnQkFDL0IsYUFBYSxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO2dCQUNsSCxXQUFXLEVBQUUsWUFBWSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7YUFDL0csQ0FBQyxDQUFDO1lBRUgsSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDO1lBRXpCLEtBQUssTUFBTSxJQUFJLElBQUksWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUN0QyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssTUFBTSxFQUFFLENBQUM7b0JBQzNCLFlBQVksRUFBRSxDQUFDO29CQUNmLGlEQUFpRDtvQkFDakQsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBQ2xCLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDM0UsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxPQUFPLGNBQWMsSUFBSSxDQUFDLFVBQVUsT0FBTyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQzt3QkFFN0csZ0NBQWdDO3dCQUNoQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssNkJBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQzs0QkFDdEMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsT0FBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUM7NEJBQ3BFLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLE9BQVEsQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDOzRCQUNwRSxNQUFNLGFBQWEsR0FBRyxPQUFPLGlCQUFpQixJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQzs0QkFFbEUscUNBQXFDOzRCQUNyQyxNQUFNLGFBQWEsR0FBRyxPQUFPLGlCQUFpQixJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQzs0QkFDcEUsSUFBSSxhQUFhLEtBQUssYUFBYSxFQUFFLENBQUM7Z0NBQ3BDLElBQUksQ0FBQyxRQUFRLENBQUMsc0JBQXNCLENBQUMsYUFBYSxFQUFFLGFBQWEsQ0FBQyxDQUFDO2dDQUNuRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx3Q0FBd0MsRUFBRTtvQ0FDekQsWUFBWSxFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUsYUFBYTtpQ0FDcEQsQ0FBQyxDQUFDOzRCQUNMLENBQUM7NEJBRUQsd0JBQXdCOzRCQUN4QixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFLENBQUM7Z0NBQzlCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO2dDQUNoRixJQUFJLGVBQWUsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssb0JBQW9CLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxLQUFLLGFBQWEsRUFBRSxDQUFDO29DQUMzRyxJQUFJLENBQUMsUUFBUSxDQUFDLHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQztvQ0FDeEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsc0NBQXNDLEVBQUU7d0NBQ3ZELFlBQVksRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLGFBQWE7cUNBQ3pELENBQUMsQ0FBQztnQ0FDTCxDQUFDOzRCQUNILENBQUM7d0JBQ0gsQ0FBQztvQkFDSCxDQUFDO3lCQUFNLENBQUM7d0JBQ04sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLE9BQU8sbUJBQW1CLENBQUMsQ0FBQztvQkFDMUYsQ0FBQztvQkFDRCxTQUFTO2dCQUNYLENBQUM7Z0JBRUQsV0FBVyxFQUFFLENBQUM7Z0JBQ2QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsVUFBVSxFQUFFLFlBQVksSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFFdkYsSUFBSSxNQUFNLEVBQUUsQ0FBQztvQkFDWCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsRUFBRTt3QkFDeEMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO3dCQUNmLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTzt3QkFDbEIsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO3FCQUM1QixDQUFDLENBQUM7b0JBQ0gsU0FBUztnQkFDWCxDQUFDO2dCQUVELG1FQUFtRTtnQkFDbkUsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQywwQkFBMEIsVUFBVSxDQUFDLGVBQWUseUJBQXlCLENBQUMsQ0FBQztvQkFDakcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDL0MsQ0FBQztnQkFDRCxhQUFhLEdBQUcsS0FBSyxDQUFDO2dCQUV0QixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLFdBQVcsSUFBSSxVQUFVLE1BQU0sSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztnQkFFNUYsSUFBSSxDQUFDO29CQUNILE1BQU0sT0FBTyxHQUFHLE9BQU8sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUM7b0JBQzlELHFFQUFxRTtvQkFDckUsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztvQkFFNUUsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDN0IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUV6RSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLElBQUksQ0FBQyxJQUFJLFVBQVUsRUFBRTt3QkFDaEQsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO3dCQUMzQixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUs7d0JBQ25CLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtxQkFDbEIsQ0FBQyxDQUFDO2dCQUNMLENBQUM7Z0JBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztvQkFDcEIsTUFBTSxRQUFRLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUN4RSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQ3BELE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO29CQUUxRixNQUFNLENBQUMsSUFBSSxDQUFDO3dCQUNWLFFBQVEsRUFBRSxJQUFJLENBQUMsVUFBVTt3QkFDekIsVUFBVSxFQUFFLElBQUksQ0FBQyxPQUFPO3dCQUN4QixLQUFLLEVBQUUsUUFBUTtxQkFDaEIsQ0FBQyxDQUFDO29CQUVILElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFdBQVcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUU7d0JBQzFELEtBQUssRUFBRSxRQUFRO3dCQUNmLFdBQVc7d0JBQ1gsV0FBVzt3QkFDWCxnQkFBZ0IsRUFBRSxXQUFXLEVBQUcsMERBQTBEO3dCQUMxRixLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUs7d0JBQ25CLElBQUksRUFBRSxXQUFXO3dCQUNqQixVQUFVO3FCQUNYLENBQUMsQ0FBQztvQkFFSCxtREFBbUQ7b0JBQ25ELElBQUksV0FBVyxFQUFFLENBQUM7d0JBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLDJEQUEyRCxDQUFDLENBQUM7d0JBQy9FLE1BQU07b0JBQ1IsQ0FBQztvQkFFRCxjQUFjO29CQUNkLElBQUksZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQzt3QkFDL0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsNENBQTRDLEVBQUU7NEJBQzdELFlBQVksRUFBRSxlQUFlLENBQUMsTUFBTTt5QkFDckMsQ0FBQyxDQUFDO3dCQUNILGNBQWMsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLENBQUM7d0JBQzdELCtEQUErRDt3QkFDL0QsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7d0JBQzNCLE1BQU07b0JBQ1IsQ0FBQztnQkFDSCxDQUFDO1lBQ0gsQ0FBQztZQUVELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBQ3BDLE1BQU0sa0JBQWtCLEdBQUcsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFDdEQsTUFBTSxjQUFjLEdBQUcsU0FBUyxJQUFJLGtCQUFrQixDQUFDO1lBRXZELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLCtCQUErQixFQUFFO2dCQUNoRCxPQUFPLEVBQUUsQ0FBQyxTQUFTO2dCQUNuQixjQUFjO2dCQUNkLFlBQVksRUFBRSxlQUFlLENBQUMsTUFBTTtnQkFDcEMsWUFBWTtnQkFDWixVQUFVLEVBQUUsTUFBTSxDQUFDLE1BQU07Z0JBQ3pCLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxjQUFjO2dCQUNuQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztvQkFDL0IsU0FBUyxFQUFFLGNBQWMsQ0FBQyxTQUFTO29CQUNuQyxTQUFTLEVBQUUsY0FBYyxDQUFDLFNBQVM7b0JBQ25DLE1BQU0sRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLE1BQU07aUJBQ3JDLENBQUMsQ0FBQyxDQUFDLFNBQVM7Z0JBQ2IsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO2FBQ3BFLENBQUMsQ0FBQztZQUVILE9BQU87Z0JBQ0wsT0FBTyxFQUFFLENBQUMsU0FBUztnQkFDbkIsY0FBYztnQkFDZCxlQUFlO2dCQUNmLFNBQVMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRTtnQkFDakMsWUFBWTtnQkFDWixNQUFNO2dCQUNOLGNBQWM7YUFDZixDQUFDO1FBQ0osQ0FBQyxDQUNGLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsV0FBVyxDQUN2QixPQUEyQjtRQUUzQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQ3JCLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBUSxFQUFFLEVBQ2hFLEtBQUssSUFBSSxFQUFFO1lBQ1QsTUFBTSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsT0FBTyxFQUFFLEdBQUcsT0FBTyxDQUFDO1lBQ3RELE1BQU0sV0FBVyxHQUFHLElBQUksb0NBQWlCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBRXpELE1BQU0sU0FBUyxHQUFHLE9BQU8sSUFBSyxZQUFvQixDQUFDLElBQUksQ0FBQztZQUV4RCxRQUFRO1lBQ1IsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUNsRSxJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUNiLE1BQU0sSUFBSSwwQkFBa0IsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDdEQsQ0FBQztZQUVELElBQUksTUFBVyxDQUFDO1lBQ2hCLElBQUksTUFBVyxDQUFDO1lBRWhCLFFBQVEsVUFBVSxFQUFFLENBQUM7Z0JBQ25CLEtBQUssNkJBQVUsQ0FBQyxRQUFRO29CQUN0QixNQUFNLEdBQUcsV0FBVyxDQUFDLGlCQUFpQixDQUFDLFlBQTJCLEVBQUUsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztvQkFDNUYsTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ2hELE9BQU87d0JBQ0wsSUFBSSxFQUFFLDZCQUFVLENBQUMsUUFBUTt3QkFDekIsVUFBVSxFQUFHLFlBQTRCLENBQUMsVUFBVTt3QkFDcEQsS0FBSyxFQUFFLE1BQU0sQ0FBQyxVQUFVO3dCQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7cUJBQ2xCLENBQUM7Z0JBRUosS0FBSyw2QkFBVSxDQUFDLE9BQU87b0JBQ3JCLE1BQU0sR0FBRyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsWUFBMEIsRUFBRSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO29CQUMxRixNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsR0FBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDL0MsT0FBTzt3QkFDTCxJQUFJLEVBQUUsNkJBQVUsQ0FBQyxPQUFPO3dCQUN4QixVQUFVLEVBQUcsWUFBMkIsQ0FBQyxTQUFTO3dCQUNsRCxLQUFLLEVBQUUsTUFBTSxDQUFDLFNBQVM7d0JBQ3ZCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtxQkFDbEIsQ0FBQztnQkFFSixLQUFLLDZCQUFVLENBQUMsR0FBRztvQkFDakIsTUFBTSxHQUFHLFdBQVcsQ0FBQyxZQUFZLENBQUMsWUFBc0IsRUFBRSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO29CQUNsRixNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsR0FBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDM0MsT0FBTzt3QkFDTCxJQUFJLEVBQUUsNkJBQVUsQ0FBQyxHQUFHO3dCQUNwQixVQUFVLEVBQUcsWUFBdUIsQ0FBQyxLQUFLO3dCQUMxQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUs7d0JBQ25CLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtxQkFDbEIsQ0FBQztnQkFFSjtvQkFDRSxNQUFNLElBQUksS0FBSyxDQUFDLDRCQUE0QixVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQzlELENBQUM7UUFDSCxDQUFDLENBQ0YsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNLLEtBQUssQ0FBQyxRQUFRLENBQ3BCLE9BQTZDO1FBRTdDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FDckIsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFRLEVBQUUsRUFDN0QsS0FBSyxJQUFJLEVBQUU7WUFDVCxPQUFPLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDN0QsQ0FBQyxDQUNGLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsWUFBWSxDQUN4QixJQUFrQixFQUNsQixPQUFlLEVBQ2YsV0FBOEI7UUFFOUIscUJBQXFCO1FBQ3JCLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyw2QkFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQy9ELElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ2IsTUFBTSxJQUFJLDBCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDbkQsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLE1BQVcsQ0FBQztRQUVoQixRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNsQixLQUFLLDZCQUFVLENBQUMsUUFBUTtnQkFDdEIsWUFBWTtnQkFDWixJQUFJLE9BQU8sSUFBSSxDQUFDLEdBQUksQ0FBQyxrQkFBa0IsS0FBSyxVQUFVLEVBQUUsQ0FBQztvQkFDdkQsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ3JFLElBQUksZ0JBQWdCLEVBQUUsQ0FBQzt3QkFDckIsTUFBTSxJQUFJLDBCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7b0JBQ25ELENBQUM7Z0JBQ0gsQ0FBQztnQkFFRCxvQ0FBb0M7Z0JBQ3BDLE1BQU0sY0FBYyxHQUFHO29CQUNyQixJQUFJLEVBQUUsT0FBTztvQkFDYixZQUFZLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZO29CQUN0Qyx5Q0FBeUM7aUJBQzFDLENBQUM7Z0JBRUYsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFJLENBQUMsY0FBYyxLQUFLLFVBQVUsRUFBRSxDQUFDO29CQUNuRCxNQUFNLElBQUkscUJBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxnREFBZ0QsQ0FBQyxDQUFDO2dCQUNoRyxDQUFDO2dCQUVELE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFJLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUV4RCx1R0FBdUc7Z0JBQ3ZHLENBQUM7b0JBQ0MsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsT0FBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUM7b0JBQ3BFLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLE9BQVEsQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDO29CQUNwRSxNQUFNLGFBQWEsR0FBRyxPQUFPLGlCQUFpQixJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFFdEUsNEVBQTRFO29CQUM1RSxNQUFNLGFBQWEsR0FBRyxPQUFPLGlCQUFpQixJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDcEUsSUFBSSxhQUFhLEtBQUssYUFBYSxFQUFFLENBQUM7d0JBQ3BDLElBQUksQ0FBQyxRQUFRLENBQUMsc0JBQXNCLENBQUMsYUFBYSxFQUFFLGFBQWEsQ0FBQyxDQUFDO3dCQUNuRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxxREFBcUQsRUFBRTs0QkFDdEUsWUFBWSxFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUsYUFBYTt5QkFDcEQsQ0FBQyxDQUFDO29CQUNMLENBQUM7b0JBRUQsdURBQXVEO29CQUN2RCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7d0JBQzdCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO3dCQUNoRixJQUFJLGVBQWUsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssb0JBQW9CLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxLQUFLLGFBQWEsRUFBRSxDQUFDOzRCQUMzRyxJQUFJLENBQUMsUUFBUSxDQUFDLHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQzs0QkFDeEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsbURBQW1ELEVBQUU7Z0NBQ3BFLFlBQVksRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLGFBQWE7NkJBQ3pELENBQUMsQ0FBQzt3QkFDTCxDQUFDO29CQUNILENBQUM7Z0JBQ0gsQ0FBQztnQkFFRCxPQUFPO29CQUNMLElBQUksRUFBRSw2QkFBVSxDQUFDLFFBQVE7b0JBQ3pCLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVTtvQkFDM0IsS0FBSyxFQUFFLE1BQU0sQ0FBQyxVQUFVO29CQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7aUJBQ2xCLENBQUM7WUFFSixLQUFLLDZCQUFVLENBQUMsUUFBUTtnQkFDdEIsTUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO2dCQUMxRSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsR0FBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDbkQsT0FBTztvQkFDTCxJQUFJLEVBQUUsNkJBQVUsQ0FBQyxRQUFRO29CQUN6QixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7b0JBQzNCLEtBQUssRUFBRSxNQUFNLENBQUMsVUFBVTtvQkFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO2lCQUNsQixDQUFDO1lBRUosS0FBSyw2QkFBVSxDQUFDLE9BQU87Z0JBQ3JCLE1BQU0sYUFBYSxHQUFHLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDN0UsTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQ3RELE9BQU87b0JBQ0wsSUFBSSxFQUFFLDZCQUFVLENBQUMsT0FBTztvQkFDeEIsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO29CQUMzQixLQUFLLEVBQUUsTUFBTSxDQUFDLFNBQVM7b0JBQ3ZCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtpQkFDbEIsQ0FBQztZQUVKLEtBQUssNkJBQVUsQ0FBQyxHQUFHO2dCQUNqQixNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO2dCQUNyRSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsR0FBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDOUMsT0FBTztvQkFDTCxJQUFJLEVBQUUsNkJBQVUsQ0FBQyxHQUFHO29CQUNwQixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7b0JBQzNCLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSztvQkFDbkIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO2lCQUNsQixDQUFDO1lBRUo7Z0JBQ0UsTUFBTSxJQUFJLHFCQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUseUJBQXlCLENBQUMsQ0FBQztRQUMzRSxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLGNBQWMsQ0FDMUIsVUFBc0IsRUFDdEIsSUFBWTtRQUVaLFFBQVEsVUFBVSxFQUFFLENBQUM7WUFDbkIsS0FBSyw2QkFBVSxDQUFDLEdBQUc7Z0JBQ2pCLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsR0FBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ2pELEtBQUssNkJBQVUsQ0FBQyxPQUFPO2dCQUNyQixPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLEdBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3JELEtBQUssNkJBQVUsQ0FBQyxRQUFRO2dCQUN0QixPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLEdBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3RELEtBQUssNkJBQVUsQ0FBQyxRQUFRO2dCQUN0QixJQUFJLE9BQU8sSUFBSSxDQUFDLEdBQUksQ0FBQyxrQkFBa0IsS0FBSyxVQUFVLEVBQUUsQ0FBQztvQkFDdkQsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDdEQsQ0FBQztnQkFDRCxPQUFPLEtBQUssQ0FBQztZQUNmO2dCQUNFLE9BQU8sS0FBSyxDQUFDO1FBQ2pCLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsZUFBZSxDQUFDLFFBQXlCO1FBQ3JELE1BQU0sTUFBTSxHQUFtQjtZQUM3QixTQUFTLEVBQUUsUUFBUSxDQUFDLE1BQU07WUFDMUIsU0FBUyxFQUFFLENBQUM7WUFDWixNQUFNLEVBQUUsRUFBRTtZQUNWLFNBQVMsRUFBRSxLQUFLO1NBQ2pCLENBQUM7UUFFRixtQkFBbUI7UUFDbkIsTUFBTSxRQUFRLEdBQUcsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRXpDLEtBQUssTUFBTSxNQUFNLElBQUksUUFBUSxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDO2dCQUNILFFBQVEsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNwQixLQUFLLDZCQUFVLENBQUMsR0FBRzt3QkFDakIsTUFBTSxJQUFJLENBQUMsR0FBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ3hDLE1BQU07b0JBQ1IsS0FBSyw2QkFBVSxDQUFDLE9BQU87d0JBQ3JCLE1BQU0sSUFBSSxDQUFDLEdBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUM1QyxNQUFNO29CQUNSLEtBQUssNkJBQVUsQ0FBQyxRQUFRO3dCQUN0QixNQUFNLElBQUksQ0FBQyxHQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDN0MsTUFBTTtvQkFDUixLQUFLLDZCQUFVLENBQUMsUUFBUTt3QkFDdEIsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFJLENBQUMsY0FBYyxLQUFLLFVBQVUsRUFBRSxDQUFDOzRCQUNuRCxNQUFNLElBQUksQ0FBQyxHQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDL0MsQ0FBQzt3QkFDRCxNQUFNO2dCQUNWLENBQUM7Z0JBQ0QsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUNyRyxDQUFDO1lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztnQkFDcEIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0JBQ2pCLFFBQVEsRUFBRSxNQUFNLENBQUMsS0FBSztvQkFDdEIsVUFBVSxFQUFFLE1BQU0sQ0FBQyxJQUFJO29CQUN2QixLQUFLLEVBQUUsS0FBSyxFQUFFLE9BQU8sSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDO2lCQUN2QyxDQUFDLENBQUM7Z0JBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsMkJBQTJCLEVBQUUsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ3BGLENBQUM7UUFDSCxDQUFDO1FBRUQsTUFBTSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFFNUMsSUFBSSxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUU7Z0JBQzdDLFNBQVMsRUFBRSxNQUFNLENBQUMsU0FBUztnQkFDM0IsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTO2dCQUMzQixNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNO2dCQUM1QixpQkFBaUIsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7YUFDM0UsQ0FBQyxDQUFDO1FBQ0wsQ0FBQzthQUFNLENBQUM7WUFDTixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsRUFBRTtnQkFDMUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTO2dCQUMzQixTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVM7YUFDNUIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7T0FFRztJQUNILFdBQVc7UUFDVCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDdkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYTtRQUNYLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDeEIsQ0FBQztDQUNGO0FBcGpCRCxvQ0FvakJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEJ1aWxkZXIgQWdlbnRcclxuICogVGFyZ2V0IOybjO2BrOyKpO2OmOydtOyKpOyXkCDsl5Tti7Dti7Ag7IOd7ISxXHJcbiAqL1xyXG5cclxuaW1wb3J0IHtcclxuICBJZE1hcHBlcixcclxuICBDb25maWdUcmFuc2Zvcm1lcixcclxuICBleHRyYWN0Q3JlYXRlQ29uZmlnLFxyXG4gIEVudGl0eVR5cGUsXHJcbiAgR1RNVGFnLFxyXG4gIEdUTVRyaWdnZXIsXHJcbiAgR1RNVmFyaWFibGUsXHJcbiAgR1RNVGVtcGxhdGUsXHJcbiAgQ3JlYXRpb25QbGFuLFxyXG4gIENyZWF0aW9uU3RlcCxcclxuICBDcmVhdGVkRW50aXR5LFxyXG4gIElkTWFwcGluZ1xyXG59IGZyb20gJ2d0bS1hZ2VudC1za2lsbHMnO1xyXG5pbXBvcnQgeyBCYXNlQWdlbnQgfSBmcm9tICcuL2Jhc2UnO1xyXG5pbXBvcnQgeyBBZ2VudFJlcXVlc3QsIEFnZW50UmVzcG9uc2UgfSBmcm9tICcuLi90eXBlcy9hZ2VudCc7XHJcbmltcG9ydCB7IFJvbGxiYWNrUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMvd29ya2Zsb3cnO1xyXG5pbXBvcnQgeyBDcmVhdGlvbkVycm9yLCBEdXBsaWNhdGVOYW1lRXJyb3IgfSBmcm9tICcuLi91dGlscy9lcnJvcic7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBSZXF1ZXN0L1Jlc3BvbnNlIFR5cGVzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWxkUmVxdWVzdCB7XHJcbiAgY3JlYXRpb25QbGFuOiBDcmVhdGlvblBsYW47XHJcbiAgbmFtZU1hcD86IE1hcDxzdHJpbmcsIHN0cmluZz47XHJcbiAgZHJ5UnVuPzogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBCdWlsZFNpbmdsZVJlcXVlc3Qge1xyXG4gIGVudGl0eVR5cGU6IEVudGl0eVR5cGU7XHJcbiAgc291cmNlRW50aXR5OiBHVE1UYWcgfCBHVE1UcmlnZ2VyIHwgR1RNVmFyaWFibGU7XHJcbiAgbmV3TmFtZT86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBCdWlsZFJlc3VsdCB7XHJcbiAgc3VjY2VzczogYm9vbGVhbjtcclxuICBwYXJ0aWFsU3VjY2VzczogYm9vbGVhbjsgIC8vIFNvbWUgZW50aXRpZXMgY3JlYXRlZCwgYnV0IHdpdGggZXJyb3JzXHJcbiAgY3JlYXRlZEVudGl0aWVzOiBDcmVhdGVkRW50aXR5W107XHJcbiAgaWRNYXBwaW5nOiBJZE1hcHBpbmc7XHJcbiAgc2tpcHBlZENvdW50OiBudW1iZXI7XHJcbiAgZXJyb3JzOiBBcnJheTx7IGVudGl0eUlkOiBzdHJpbmc7IGVudGl0eU5hbWU6IHN0cmluZzsgZXJyb3I6IHN0cmluZyB9PjtcclxuICByb2xsYmFja1Jlc3VsdD86IFJvbGxiYWNrUmVzdWx0OyAgLy8gUm9sbGJhY2sgdHJhY2tpbmcgaW5mb3JtYXRpb25cclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT0gUmF0ZSBMaW1pdGluZyBDb25zdGFudHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBHVE0gQVBJIFJhdGUgTGltaXQ6IDE1IHJlcXVlc3RzIHBlciBtaW51dGUgKDAuMjUgUVBTKVxyXG4gKiBXZSB1c2UgY29uc2VydmF0aXZlIHNldHRpbmdzIHRvIGF2b2lkIHF1b3RhIGV4aGF1c3Rpb25cclxuICovXHJcbmNvbnN0IFJBVEVfTElNSVQgPSB7XHJcbiAgLy8gRGVsYXkgYmV0d2VlbiBlbnRpdHkgY3JlYXRpb25zIChtaWxsaXNlY29uZHMpIC0gNCBzZWNvbmRzID0gMTUgcmVxL21pblxyXG4gIEVOVElUWV9ERUxBWV9NUzogNDAwMCxcclxuICAvLyBNYXhpbXVtIHJldHJ5IGF0dGVtcHRzIGZvciByYXRlIGxpbWl0IGVycm9yc1xyXG4gIE1BWF9SRVRSSUVTOiAzLFxyXG4gIC8vIEJhc2UgZGVsYXkgZm9yIGV4cG9uZW50aWFsIGJhY2tvZmYgKG1pbGxpc2Vjb25kcylcclxuICBCQUNLT0ZGX0JBU0VfTVM6IDEwMDAsXHJcbiAgLy8gTWF4aW11bSBkZWxheSBmb3IgZXhwb25lbnRpYWwgYmFja29mZiAobWlsbGlzZWNvbmRzKSAtIDYwIHNlY29uZHNcclxuICBCQUNLT0ZGX01BWF9NUzogNjAwMDAsXHJcbn07XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBCdWlsZGVyIEFnZW50ID09PT09PT09PT09PT09PT09PT09XHJcblxyXG5leHBvcnQgY2xhc3MgQnVpbGRlckFnZW50IGV4dGVuZHMgQmFzZUFnZW50IHtcclxuICBwcml2YXRlIGlkTWFwcGVyOiBJZE1hcHBlcjtcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICBzdXBlcignYnVpbGRlcicpO1xyXG4gICAgdGhpcy5pZE1hcHBlciA9IG5ldyBJZE1hcHBlcigpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsYXkgaGVscGVyXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBkZWxheShtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxjdWxhdGUgZXhwb25lbnRpYWwgYmFja29mZiBkZWxheVxyXG4gICAqL1xyXG4gIHByaXZhdGUgY2FsY3VsYXRlQmFja29mZkRlbGF5KGF0dGVtcHQ6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICBjb25zdCBkZWxheSA9IFJBVEVfTElNSVQuQkFDS09GRl9CQVNFX01TICogTWF0aC5wb3coMiwgYXR0ZW1wdCk7XHJcbiAgICByZXR1cm4gTWF0aC5taW4oZGVsYXksIFJBVEVfTElNSVQuQkFDS09GRl9NQVhfTVMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgZXJyb3IgaXMgYSByYXRlIGxpbWl0IGVycm9yXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBpc1JhdGVMaW1pdEVycm9yKGVycm9yTXNnOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHJhdGVMaW1pdFBhdHRlcm5zID0gW1xyXG4gICAgICAnNDI5JyxcclxuICAgICAgJ3JhdGUgbGltaXQnLFxyXG4gICAgICAncmF0ZV9saW1pdCcsXHJcbiAgICAgICdyYXRlTGltaXQnLFxyXG4gICAgICAncXVvdGEnLFxyXG4gICAgICAndG9vIG1hbnkgcmVxdWVzdHMnLFxyXG4gICAgICAnZXhjZWVkZWQnLFxyXG4gICAgICAnNDAzJyAgLy8gU29tZXRpbWVzIHF1b3RhIGVycm9ycyByZXR1cm4gNDAzXHJcbiAgICBdO1xyXG4gICAgY29uc3QgbG93ZXJNc2cgPSBlcnJvck1zZy50b0xvd2VyQ2FzZSgpO1xyXG4gICAgcmV0dXJuIHJhdGVMaW1pdFBhdHRlcm5zLnNvbWUocGF0dGVybiA9PiBsb3dlck1zZy5pbmNsdWRlcyhwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBlbnRpdHkgd2l0aCBhdXRvbWF0aWMgcmV0cnkgZm9yIHJhdGUgbGltaXQgZXJyb3JzXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyBjcmVhdGVFbnRpdHlXaXRoUmV0cnkoXHJcbiAgICBzdGVwOiBDcmVhdGlvblN0ZXAsXHJcbiAgICBuZXdOYW1lOiBzdHJpbmcsXHJcbiAgICB0cmFuc2Zvcm1lcjogQ29uZmlnVHJhbnNmb3JtZXJcclxuICApOiBQcm9taXNlPENyZWF0ZWRFbnRpdHk+IHtcclxuICAgIGxldCBsYXN0RXJyb3I6IEVycm9yIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgZm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPCBSQVRFX0xJTUlULk1BWF9SRVRSSUVTOyBhdHRlbXB0KyspIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5jcmVhdGVFbnRpdHkoc3RlcCwgbmV3TmFtZSwgdHJhbnNmb3JtZXIpO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgbGFzdEVycm9yID0gZXJyb3I7XHJcbiAgICAgICAgY29uc3QgZXJyb3JNc2cgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmlzUmF0ZUxpbWl0RXJyb3IoZXJyb3JNc2cpKSB7XHJcbiAgICAgICAgICBpZiAoYXR0ZW1wdCA8IFJBVEVfTElNSVQuTUFYX1JFVFJJRVMgLSAxKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJhY2tvZmZEZWxheSA9IHRoaXMuY2FsY3VsYXRlQmFja29mZkRlbGF5KGF0dGVtcHQpO1xyXG4gICAgICAgICAgICB0aGlzLmxvZ2dlci53YXJuKGBSYXRlIGxpbWl0IGhpdCwgcmV0cnlpbmcgaW4gJHtiYWNrb2ZmRGVsYXl9bXNgLCB7XHJcbiAgICAgICAgICAgICAgYXR0ZW1wdDogYXR0ZW1wdCArIDEsXHJcbiAgICAgICAgICAgICAgbWF4UmV0cmllczogUkFURV9MSU1JVC5NQVhfUkVUUklFUyxcclxuICAgICAgICAgICAgICBlbnRpdHlUeXBlOiBzdGVwLnR5cGUsXHJcbiAgICAgICAgICAgICAgZW50aXR5TmFtZTogbmV3TmFtZVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5kZWxheShiYWNrb2ZmRGVsYXkpO1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIE5vbi1yYXRlLWxpbWl0IGVycm9yIG9yIG1heCByZXRyaWVzIHJlYWNoZWRcclxuICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFRoaXMgc2hvdWxkIG5vdCBiZSByZWFjaGVkLCBidXQgVHlwZVNjcmlwdCBuZWVkcyBpdFxyXG4gICAgdGhyb3cgbGFzdEVycm9yIHx8IG5ldyBFcnJvcignVW5rbm93biBlcnJvciBkdXJpbmcgZW50aXR5IGNyZWF0aW9uJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDsmpTssq0g7LKY66asXHJcbiAgICovXHJcbiAgYXN5bmMgZXhlY3V0ZTxULCBSPihyZXF1ZXN0OiBBZ2VudFJlcXVlc3Q8VD4pOiBQcm9taXNlPEFnZW50UmVzcG9uc2U8Uj4+IHtcclxuICAgIHRoaXMudmFsaWRhdGVDb250ZXh0KCk7XHJcblxyXG4gICAgc3dpdGNoIChyZXF1ZXN0LmFjdGlvbikge1xyXG4gICAgICBjYXNlICdidWlsZCc6XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGQocmVxdWVzdC5kYXRhIGFzIEJ1aWxkUmVxdWVzdCkgYXMgUHJvbWlzZTxBZ2VudFJlc3BvbnNlPFI+PjtcclxuXHJcbiAgICAgIGNhc2UgJ2J1aWxkU2luZ2xlJzpcclxuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFNpbmdsZShyZXF1ZXN0LmRhdGEgYXMgQnVpbGRTaW5nbGVSZXF1ZXN0KSBhcyBQcm9taXNlPEFnZW50UmVzcG9uc2U8Uj4+O1xyXG5cclxuICAgICAgY2FzZSAncm9sbGJhY2snOlxyXG4gICAgICAgIHJldHVybiB0aGlzLnJvbGxiYWNrKHJlcXVlc3QuZGF0YSBhcyB7IGNyZWF0ZWRFbnRpdGllczogQ3JlYXRlZEVudGl0eVtdIH0pIGFzIFByb21pc2U8QWdlbnRSZXNwb25zZTxSPj47XHJcblxyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBhY3Rpb246ICR7cmVxdWVzdC5hY3Rpb259YCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDsg53shLEg6rOE7ZqNIOyLpO2WiVxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgYnVpbGQocmVxdWVzdDogQnVpbGRSZXF1ZXN0KTogUHJvbWlzZTxBZ2VudFJlc3BvbnNlPEJ1aWxkUmVzdWx0Pj4ge1xyXG4gICAgcmV0dXJuIHRoaXMuc2FmZUV4ZWN1dGUoXHJcbiAgICAgIHsgYWN0aW9uOiAnYnVpbGQnLCBkYXRhOiByZXF1ZXN0LCBjb250ZXh0OiB0aGlzLmNvbnRleHQhIH0sXHJcbiAgICAgIGFzeW5jICgpID0+IHtcclxuICAgICAgICBjb25zdCB7IGNyZWF0aW9uUGxhbiwgbmFtZU1hcCwgZHJ5UnVuIH0gPSByZXF1ZXN0O1xyXG4gICAgICAgIHRoaXMuaWRNYXBwZXIuY2xlYXIoKTtcclxuXHJcbiAgICAgICAgY29uc3QgY3JlYXRlZEVudGl0aWVzOiBDcmVhdGVkRW50aXR5W10gPSBbXTtcclxuICAgICAgICBjb25zdCBlcnJvcnM6IEFycmF5PHsgZW50aXR5SWQ6IHN0cmluZzsgZW50aXR5TmFtZTogc3RyaW5nOyBlcnJvcjogc3RyaW5nIH0+ID0gW107XHJcbiAgICAgICAgbGV0IHNraXBwZWRDb3VudCA9IDA7XHJcbiAgICAgICAgbGV0IHJvbGxiYWNrUmVzdWx0OiBSb2xsYmFja1Jlc3VsdCB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgQ29uZmlnVHJhbnNmb3JtZXIodGhpcy5pZE1hcHBlcik7XHJcbiAgICAgICAgY29uc3QgdG90YWxTdGVwcyA9IGNyZWF0aW9uUGxhbi5zdGVwcy5maWx0ZXIocyA9PiBzLmFjdGlvbiA9PT0gJ0NSRUFURScpLmxlbmd0aDtcclxuICAgICAgICBsZXQgY3VycmVudFN0ZXAgPSAwO1xyXG5cclxuICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKCc9PT0gQlVJTEQgUEhBU0UgU1RBUlRFRCA9PT0nLCB7XHJcbiAgICAgICAgICB0b3RhbFN0ZXBzLFxyXG4gICAgICAgICAgZHJ5UnVuOiBkcnlSdW4gfHwgZmFsc2UsXHJcbiAgICAgICAgICByYXRlTGltaXREZWxheU1zOiBSQVRFX0xJTUlULkVOVElUWV9ERUxBWV9NUyxcclxuICAgICAgICAgIG1heFJldHJpZXM6IFJBVEVfTElNSVQuTUFYX1JFVFJJRVMsXHJcbiAgICAgICAgICB3YXJuaW5nczogY3JlYXRpb25QbGFuLndhcm5pbmdzLFxyXG4gICAgICAgICAgc3RlcHNUb0NyZWF0ZTogY3JlYXRpb25QbGFuLnN0ZXBzLmZpbHRlcihzID0+IHMuYWN0aW9uID09PSAnQ1JFQVRFJykubWFwKHMgPT4gKHsgdHlwZTogcy50eXBlLCBuYW1lOiBzLm5ld05hbWUgfSkpLFxyXG4gICAgICAgICAgc3RlcHNUb1NraXA6IGNyZWF0aW9uUGxhbi5zdGVwcy5maWx0ZXIocyA9PiBzLmFjdGlvbiA9PT0gJ1NLSVAnKS5tYXAocyA9PiAoeyB0eXBlOiBzLnR5cGUsIG5hbWU6IHMubmV3TmFtZSB9KSlcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbGV0IGlzRmlyc3RDcmVhdGUgPSB0cnVlO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHN0ZXAgb2YgY3JlYXRpb25QbGFuLnN0ZXBzKSB7XHJcbiAgICAgICAgICBpZiAoc3RlcC5hY3Rpb24gPT09ICdTS0lQJykge1xyXG4gICAgICAgICAgICBza2lwcGVkQ291bnQrKztcclxuICAgICAgICAgICAgLy8gU0tJUOuQnCDsl5Tti7Dti7Drj4QgSUQg66ek7ZWR7JeQIOy2lOqwgCAodGFyZ2V07JeQIOydtOuvuCDsobTsnqztlZjripQg7JeU7Yuw7Yuw7J2YIElEKVxyXG4gICAgICAgICAgICBpZiAoc3RlcC50YXJnZXRJZCkge1xyXG4gICAgICAgICAgICAgIHRoaXMuaWRNYXBwZXIuYWRkKHN0ZXAub3JpZ2luYWxJZCwgc3RlcC50YXJnZXRJZCwgc3RlcC50eXBlLCBzdGVwLm5ld05hbWUpO1xyXG4gICAgICAgICAgICAgIHRoaXMubG9nZ2VyLmluZm8oYFNLSVArTUFQOiAke3N0ZXAudHlwZX0gXCIke3N0ZXAubmV3TmFtZX1cIiAtIG1hcHBlZCAke3N0ZXAub3JpZ2luYWxJZH0gLT4gJHtzdGVwLnRhcmdldElkfWApO1xyXG5cclxuICAgICAgICAgICAgICAvLyBUZW1wbGF0ZSBTS0lQOiBjdnQgdHlwZSDrp6TtlZEg65Ox66GdXHJcbiAgICAgICAgICAgICAgaWYgKHN0ZXAudHlwZSA9PT0gRW50aXR5VHlwZS5URU1QTEFURSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc291cmNlQ29udGFpbmVySWQgPSB0aGlzLmNvbnRleHQhLnNvdXJjZVdvcmtzcGFjZS5jb250YWluZXJJZDtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldENvbnRhaW5lcklkID0gdGhpcy5jb250ZXh0IS50YXJnZXRXb3Jrc3BhY2UuY29udGFpbmVySWQ7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRDdnRUeXBlID0gYGN2dF8ke3RhcmdldENvbnRhaW5lcklkfV8ke3N0ZXAudGFyZ2V0SWR9YDtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyAxLiBDb250YWluZXItc3BlY2lmaWMgdHlwZSBtYXBwaW5nXHJcbiAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VDdnRUeXBlID0gYGN2dF8ke3NvdXJjZUNvbnRhaW5lcklkfV8ke3N0ZXAub3JpZ2luYWxJZH1gO1xyXG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZUN2dFR5cGUgIT09IHRhcmdldEN2dFR5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgdGhpcy5pZE1hcHBlci5hZGRUZW1wbGF0ZVR5cGVNYXBwaW5nKHNvdXJjZUN2dFR5cGUsIHRhcmdldEN2dFR5cGUpO1xyXG4gICAgICAgICAgICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKCdUZW1wbGF0ZSB0eXBlIG1hcHBpbmcgKFNLSVAvY29udGFpbmVyKScsIHtcclxuICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbFR5cGU6IHNvdXJjZUN2dFR5cGUsIG5ld1R5cGU6IHRhcmdldEN2dFR5cGVcclxuICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gMi4gR2FsbGVyeSBJRCBtYXBwaW5nXHJcbiAgICAgICAgICAgICAgICBpZiAoc3RlcC5jb25maWc/LnRlbXBsYXRlRGF0YSkge1xyXG4gICAgICAgICAgICAgICAgICBjb25zdCBnYWxsZXJ5Q3Z0TWF0Y2ggPSBzdGVwLmNvbmZpZy50ZW1wbGF0ZURhdGEubWF0Y2goL1wiaWRcIjpcXHMqXCIoY3Z0X1teXCJdKylcIi8pO1xyXG4gICAgICAgICAgICAgICAgICBpZiAoZ2FsbGVyeUN2dE1hdGNoICYmIGdhbGxlcnlDdnRNYXRjaFsxXSAhPT0gJ2N2dF90ZW1wX3B1YmxpY19pZCcgJiYgZ2FsbGVyeUN2dE1hdGNoWzFdICE9PSB0YXJnZXRDdnRUeXBlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pZE1hcHBlci5hZGRUZW1wbGF0ZVR5cGVNYXBwaW5nKGdhbGxlcnlDdnRNYXRjaFsxXSwgdGFyZ2V0Q3Z0VHlwZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2dnZXIuaW5mbygnVGVtcGxhdGUgdHlwZSBtYXBwaW5nIChTS0lQL2dhbGxlcnkpJywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxUeXBlOiBnYWxsZXJ5Q3Z0TWF0Y2hbMV0sIG5ld1R5cGU6IHRhcmdldEN2dFR5cGVcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICB0aGlzLmxvZ2dlci53YXJuKGBTS0lQIChubyB0YXJnZXQgSUQpOiAke3N0ZXAudHlwZX0gXCIke3N0ZXAubmV3TmFtZX1cIiAtIGNhbm5vdCBtYXAgSURgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBjdXJyZW50U3RlcCsrO1xyXG4gICAgICAgICAgdGhpcy5yZXBvcnRQcm9ncmVzcyhjdXJyZW50U3RlcCwgdG90YWxTdGVwcywgYENyZWF0aW5nICR7c3RlcC50eXBlfTogJHtzdGVwLm5ld05hbWV9YCk7XHJcblxyXG4gICAgICAgICAgaWYgKGRyeVJ1bikge1xyXG4gICAgICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKCdEUlkgUlVOOiB3b3VsZCBjcmVhdGUnLCB7XHJcbiAgICAgICAgICAgICAgdHlwZTogc3RlcC50eXBlLFxyXG4gICAgICAgICAgICAgIG5hbWU6IHN0ZXAubmV3TmFtZSxcclxuICAgICAgICAgICAgICBvcmlnaW5hbElkOiBzdGVwLm9yaWdpbmFsSWRcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFJhdGUgbGltaXRpbmc6IGRlbGF5IGJldHdlZW4gZW50aXR5IGNyZWF0aW9ucyAoZXhjZXB0IGZpcnN0IG9uZSlcclxuICAgICAgICAgIGlmICghaXNGaXJzdENyZWF0ZSkge1xyXG4gICAgICAgICAgICB0aGlzLmxvZ2dlci5kZWJ1ZyhgUmF0ZSBsaW1pdGluZzogd2FpdGluZyAke1JBVEVfTElNSVQuRU5USVRZX0RFTEFZX01TfW1zIGJlZm9yZSBuZXh0IGNyZWF0aW9uYCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZGVsYXkoUkFURV9MSU1JVC5FTlRJVFlfREVMQVlfTVMpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaXNGaXJzdENyZWF0ZSA9IGZhbHNlO1xyXG5cclxuICAgICAgICAgIHRoaXMubG9nZ2VyLmluZm8oYENSRUFUSU5HIFske2N1cnJlbnRTdGVwfS8ke3RvdGFsU3RlcHN9XTogJHtzdGVwLnR5cGV9IFwiJHtzdGVwLm5ld05hbWV9XCJgKTtcclxuXHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBuZXdOYW1lID0gbmFtZU1hcD8uZ2V0KHN0ZXAub3JpZ2luYWxJZCkgfHwgc3RlcC5uZXdOYW1lO1xyXG4gICAgICAgICAgICAvLyBVc2UgY3JlYXRlRW50aXR5V2l0aFJldHJ5IGZvciBhdXRvbWF0aWMgcmV0cnkgb24gcmF0ZSBsaW1pdCBlcnJvcnNcclxuICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gYXdhaXQgdGhpcy5jcmVhdGVFbnRpdHlXaXRoUmV0cnkoc3RlcCwgbmV3TmFtZSwgdHJhbnNmb3JtZXIpO1xyXG5cclxuICAgICAgICAgICAgY3JlYXRlZEVudGl0aWVzLnB1c2goZW50aXR5KTtcclxuICAgICAgICAgICAgdGhpcy5pZE1hcHBlci5hZGQoc3RlcC5vcmlnaW5hbElkLCBlbnRpdHkubmV3SWQsIHN0ZXAudHlwZSwgZW50aXR5Lm5hbWUpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5sb2dnZXIuaW5mbyhgU1VDQ0VTUzogJHtzdGVwLnR5cGV9IGNyZWF0ZWRgLCB7XHJcbiAgICAgICAgICAgICAgb3JpZ2luYWxJZDogc3RlcC5vcmlnaW5hbElkLFxyXG4gICAgICAgICAgICAgIG5ld0lkOiBlbnRpdHkubmV3SWQsXHJcbiAgICAgICAgICAgICAgbmFtZTogZW50aXR5Lm5hbWVcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xyXG4gICAgICAgICAgICBjb25zdCBpc1JhdGVMaW1pdCA9IHRoaXMuaXNSYXRlTGltaXRFcnJvcihlcnJvck1zZyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGlzRHVwbGljYXRlID0gZXJyb3JNc2cuaW5jbHVkZXMoJ2R1cGxpY2F0ZScpIHx8IGVycm9yTXNnLmluY2x1ZGVzKCdhbHJlYWR5IGV4aXN0cycpO1xyXG5cclxuICAgICAgICAgICAgZXJyb3JzLnB1c2goe1xyXG4gICAgICAgICAgICAgIGVudGl0eUlkOiBzdGVwLm9yaWdpbmFsSWQsXHJcbiAgICAgICAgICAgICAgZW50aXR5TmFtZTogc3RlcC5uZXdOYW1lLFxyXG4gICAgICAgICAgICAgIGVycm9yOiBlcnJvck1zZ1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKGBGQUlMRUQ6ICR7c3RlcC50eXBlfSBcIiR7c3RlcC5uZXdOYW1lfVwiYCwge1xyXG4gICAgICAgICAgICAgIGVycm9yOiBlcnJvck1zZyxcclxuICAgICAgICAgICAgICBpc1JhdGVMaW1pdCxcclxuICAgICAgICAgICAgICBpc0R1cGxpY2F0ZSxcclxuICAgICAgICAgICAgICByZXRyaWVzRXhoYXVzdGVkOiBpc1JhdGVMaW1pdCwgIC8vIElmIHJhdGUgbGltaXQgZXJyb3IgcmVhY2hlZCBoZXJlLCByZXRyaWVzIGFyZSBleGhhdXN0ZWRcclxuICAgICAgICAgICAgICBzdGFjazogZXJyb3I/LnN0YWNrLFxyXG4gICAgICAgICAgICAgIHN0ZXA6IGN1cnJlbnRTdGVwLFxyXG4gICAgICAgICAgICAgIHRvdGFsU3RlcHNcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyBSYXRlIGxpbWl0IOyXkOufrOuptCDsponsi5wg7KSR64uoIChyZXRyaWVzIGFscmVhZHkgZXhoYXVzdGVkKVxyXG4gICAgICAgICAgICBpZiAoaXNSYXRlTGltaXQpIHtcclxuICAgICAgICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcignPT09IEJVSUxEIEFCT1JURUQ6IEFQSSBSYXRlIExpbWl0IChyZXRyaWVzIGV4aGF1c3RlZCkgPT09Jyk7XHJcbiAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIOuhpOuwsSDtlYTsmpQg7Jes67aAIO2MkOuLqFxyXG4gICAgICAgICAgICBpZiAoY3JlYXRlZEVudGl0aWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICB0aGlzLmxvZ2dlci53YXJuKCdSb2xsaW5nIGJhY2sgY3JlYXRlZCBlbnRpdGllcyBkdWUgdG8gZXJyb3InLCB7XHJcbiAgICAgICAgICAgICAgICBjcmVhdGVkQ291bnQ6IGNyZWF0ZWRFbnRpdGllcy5sZW5ndGhcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICByb2xsYmFja1Jlc3VsdCA9IGF3YWl0IHRoaXMucGVyZm9ybVJvbGxiYWNrKGNyZWF0ZWRFbnRpdGllcyk7XHJcbiAgICAgICAgICAgICAgLy8gQ2xlYXIgY3JlYXRlZCBlbnRpdGllcyBhZnRlciByb2xsYmFjayAodGhleSd2ZSBiZWVuIGRlbGV0ZWQpXHJcbiAgICAgICAgICAgICAgY3JlYXRlZEVudGl0aWVzLmxlbmd0aCA9IDA7XHJcbiAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGhhc0Vycm9ycyA9IGVycm9ycy5sZW5ndGggPiAwO1xyXG4gICAgICAgIGNvbnN0IGhhc0NyZWF0ZWRFbnRpdGllcyA9IGNyZWF0ZWRFbnRpdGllcy5sZW5ndGggPiAwO1xyXG4gICAgICAgIGNvbnN0IHBhcnRpYWxTdWNjZXNzID0gaGFzRXJyb3JzICYmIGhhc0NyZWF0ZWRFbnRpdGllcztcclxuXHJcbiAgICAgICAgdGhpcy5sb2dnZXIuaW5mbygnPT09IEJVSUxEIFBIQVNFIENPTVBMRVRFRCA9PT0nLCB7XHJcbiAgICAgICAgICBzdWNjZXNzOiAhaGFzRXJyb3JzLFxyXG4gICAgICAgICAgcGFydGlhbFN1Y2Nlc3MsXHJcbiAgICAgICAgICBjcmVhdGVkQ291bnQ6IGNyZWF0ZWRFbnRpdGllcy5sZW5ndGgsXHJcbiAgICAgICAgICBza2lwcGVkQ291bnQsXHJcbiAgICAgICAgICBlcnJvckNvdW50OiBlcnJvcnMubGVuZ3RoLFxyXG4gICAgICAgICAgcm9sbGJhY2tQZXJmb3JtZWQ6ICEhcm9sbGJhY2tSZXN1bHQsXHJcbiAgICAgICAgICByb2xsYmFja1Jlc3VsdDogcm9sbGJhY2tSZXN1bHQgPyB7XHJcbiAgICAgICAgICAgIGF0dGVtcHRlZDogcm9sbGJhY2tSZXN1bHQuYXR0ZW1wdGVkLFxyXG4gICAgICAgICAgICBzdWNjZWVkZWQ6IHJvbGxiYWNrUmVzdWx0LnN1Y2NlZWRlZCxcclxuICAgICAgICAgICAgZmFpbGVkOiByb2xsYmFja1Jlc3VsdC5mYWlsZWQubGVuZ3RoXHJcbiAgICAgICAgICB9IDogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgZXJyb3JzOiBlcnJvcnMubWFwKGUgPT4gKHsgZW50aXR5OiBlLmVudGl0eU5hbWUsIGVycm9yOiBlLmVycm9yIH0pKVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgc3VjY2VzczogIWhhc0Vycm9ycyxcclxuICAgICAgICAgIHBhcnRpYWxTdWNjZXNzLFxyXG4gICAgICAgICAgY3JlYXRlZEVudGl0aWVzLFxyXG4gICAgICAgICAgaWRNYXBwaW5nOiB0aGlzLmlkTWFwcGVyLmdldEFsbCgpLFxyXG4gICAgICAgICAgc2tpcHBlZENvdW50LFxyXG4gICAgICAgICAgZXJyb3JzLFxyXG4gICAgICAgICAgcm9sbGJhY2tSZXN1bHRcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog64uo7J28IOyXlO2LsO2LsCDsg53shLFcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIGJ1aWxkU2luZ2xlKFxyXG4gICAgcmVxdWVzdDogQnVpbGRTaW5nbGVSZXF1ZXN0XHJcbiAgKTogUHJvbWlzZTxBZ2VudFJlc3BvbnNlPENyZWF0ZWRFbnRpdHk+PiB7XHJcbiAgICByZXR1cm4gdGhpcy5zYWZlRXhlY3V0ZShcclxuICAgICAgeyBhY3Rpb246ICdidWlsZFNpbmdsZScsIGRhdGE6IHJlcXVlc3QsIGNvbnRleHQ6IHRoaXMuY29udGV4dCEgfSxcclxuICAgICAgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHsgZW50aXR5VHlwZSwgc291cmNlRW50aXR5LCBuZXdOYW1lIH0gPSByZXF1ZXN0O1xyXG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IENvbmZpZ1RyYW5zZm9ybWVyKHRoaXMuaWRNYXBwZXIpO1xyXG5cclxuICAgICAgICBjb25zdCBmaW5hbE5hbWUgPSBuZXdOYW1lIHx8IChzb3VyY2VFbnRpdHkgYXMgYW55KS5uYW1lO1xyXG5cclxuICAgICAgICAvLyDspJHrs7Ug6rKA7IKsXHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCB0aGlzLmNoZWNrRHVwbGljYXRlKGVudGl0eVR5cGUsIGZpbmFsTmFtZSk7XHJcbiAgICAgICAgaWYgKGV4aXN0aW5nKSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRHVwbGljYXRlTmFtZUVycm9yKGVudGl0eVR5cGUsIGZpbmFsTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgY29uZmlnOiBhbnk7XHJcbiAgICAgICAgbGV0IHJlc3VsdDogYW55O1xyXG5cclxuICAgICAgICBzd2l0Y2ggKGVudGl0eVR5cGUpIHtcclxuICAgICAgICAgIGNhc2UgRW50aXR5VHlwZS5WQVJJQUJMRTpcclxuICAgICAgICAgICAgY29uZmlnID0gdHJhbnNmb3JtZXIudHJhbnNmb3JtVmFyaWFibGUoc291cmNlRW50aXR5IGFzIEdUTVZhcmlhYmxlLCB7IG5ld05hbWU6IGZpbmFsTmFtZSB9KTtcclxuICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy5tY3AhLmNyZWF0ZVZhcmlhYmxlKGNvbmZpZyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgdHlwZTogRW50aXR5VHlwZS5WQVJJQUJMRSxcclxuICAgICAgICAgICAgICBvcmlnaW5hbElkOiAoc291cmNlRW50aXR5IGFzIEdUTVZhcmlhYmxlKS52YXJpYWJsZUlkLFxyXG4gICAgICAgICAgICAgIG5ld0lkOiByZXN1bHQudmFyaWFibGVJZCxcclxuICAgICAgICAgICAgICBuYW1lOiByZXN1bHQubmFtZVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgIGNhc2UgRW50aXR5VHlwZS5UUklHR0VSOlxyXG4gICAgICAgICAgICBjb25maWcgPSB0cmFuc2Zvcm1lci50cmFuc2Zvcm1UcmlnZ2VyKHNvdXJjZUVudGl0eSBhcyBHVE1UcmlnZ2VyLCB7IG5ld05hbWU6IGZpbmFsTmFtZSB9KTtcclxuICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy5tY3AhLmNyZWF0ZVRyaWdnZXIoY29uZmlnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICB0eXBlOiBFbnRpdHlUeXBlLlRSSUdHRVIsXHJcbiAgICAgICAgICAgICAgb3JpZ2luYWxJZDogKHNvdXJjZUVudGl0eSBhcyBHVE1UcmlnZ2VyKS50cmlnZ2VySWQsXHJcbiAgICAgICAgICAgICAgbmV3SWQ6IHJlc3VsdC50cmlnZ2VySWQsXHJcbiAgICAgICAgICAgICAgbmFtZTogcmVzdWx0Lm5hbWVcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICBjYXNlIEVudGl0eVR5cGUuVEFHOlxyXG4gICAgICAgICAgICBjb25maWcgPSB0cmFuc2Zvcm1lci50cmFuc2Zvcm1UYWcoc291cmNlRW50aXR5IGFzIEdUTVRhZywgeyBuZXdOYW1lOiBmaW5hbE5hbWUgfSk7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMubWNwIS5jcmVhdGVUYWcoY29uZmlnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICB0eXBlOiBFbnRpdHlUeXBlLlRBRyxcclxuICAgICAgICAgICAgICBvcmlnaW5hbElkOiAoc291cmNlRW50aXR5IGFzIEdUTVRhZykudGFnSWQsXHJcbiAgICAgICAgICAgICAgbmV3SWQ6IHJlc3VsdC50YWdJZCxcclxuICAgICAgICAgICAgICBuYW1lOiByZXN1bHQubmFtZVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZW50aXR5IHR5cGU6ICR7ZW50aXR5VHlwZX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDroaTrsLEg7Iuk7ZaJXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyByb2xsYmFjayhcclxuICAgIHJlcXVlc3Q6IHsgY3JlYXRlZEVudGl0aWVzOiBDcmVhdGVkRW50aXR5W10gfVxyXG4gICk6IFByb21pc2U8QWdlbnRSZXNwb25zZTxSb2xsYmFja1Jlc3VsdD4+IHtcclxuICAgIHJldHVybiB0aGlzLnNhZmVFeGVjdXRlKFxyXG4gICAgICB7IGFjdGlvbjogJ3JvbGxiYWNrJywgZGF0YTogcmVxdWVzdCwgY29udGV4dDogdGhpcy5jb250ZXh0ISB9LFxyXG4gICAgICBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucGVyZm9ybVJvbGxiYWNrKHJlcXVlc3QuY3JlYXRlZEVudGl0aWVzKTtcclxuICAgICAgfVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOyXlO2LsO2LsCDsg53shLFcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZUVudGl0eShcclxuICAgIHN0ZXA6IENyZWF0aW9uU3RlcCxcclxuICAgIG5ld05hbWU6IHN0cmluZyxcclxuICAgIHRyYW5zZm9ybWVyOiBDb25maWdUcmFuc2Zvcm1lclxyXG4gICk6IFByb21pc2U8Q3JlYXRlZEVudGl0eT4ge1xyXG4gICAgLy8g7KSR67O1IOqygOyCrCAo7YWc7ZSM66a/7J2AIOuzhOuPhCDsspjrpqwpXHJcbiAgICBpZiAoc3RlcC50eXBlICE9PSBFbnRpdHlUeXBlLlRFTVBMQVRFKSB7XHJcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgdGhpcy5jaGVja0R1cGxpY2F0ZShzdGVwLnR5cGUsIG5ld05hbWUpO1xyXG4gICAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRHVwbGljYXRlTmFtZUVycm9yKHN0ZXAudHlwZSwgbmV3TmFtZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBsZXQgcmVzdWx0OiBhbnk7XHJcblxyXG4gICAgc3dpdGNoIChzdGVwLnR5cGUpIHtcclxuICAgICAgY2FzZSBFbnRpdHlUeXBlLlRFTVBMQVRFOlxyXG4gICAgICAgIC8vIO2FnO2UjOumvyDspJHrs7Ug6rKA7IKsXHJcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm1jcCEuZmluZFRlbXBsYXRlQnlOYW1lID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICBjb25zdCBleGlzdGluZ1RlbXBsYXRlID0gYXdhaXQgdGhpcy5tY3AhLmZpbmRUZW1wbGF0ZUJ5TmFtZShuZXdOYW1lKTtcclxuICAgICAgICAgIGlmIChleGlzdGluZ1RlbXBsYXRlKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBEdXBsaWNhdGVOYW1lRXJyb3Ioc3RlcC50eXBlLCBuZXdOYW1lKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHRlbXBsYXRlRGF0YeuKlCDqt7jrjIDroZwg67O17IKsIChMTE0g67aE7ISdIOu2iO2VhOyalClcclxuICAgICAgICBjb25zdCB0ZW1wbGF0ZUNvbmZpZyA9IHtcclxuICAgICAgICAgIG5hbWU6IG5ld05hbWUsXHJcbiAgICAgICAgICB0ZW1wbGF0ZURhdGE6IHN0ZXAuY29uZmlnLnRlbXBsYXRlRGF0YVxyXG4gICAgICAgICAgLy8gZ2FsbGVyeVJlZmVyZW5jZeuKlCDrs7XsgqztlZjsp4Ag7JWK7J2MICjsg4gg7YWc7ZSM66a/7Jy866GcIOyDneyEsSlcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIHRoaXMubWNwIS5jcmVhdGVUZW1wbGF0ZSAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IENyZWF0aW9uRXJyb3Ioc3RlcC50eXBlLCBuZXdOYW1lLCAnVGVtcGxhdGUgY3JlYXRpb24gbm90IHN1cHBvcnRlZCBieSBNQ1AgYWRhcHRlcicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy5tY3AhLmNyZWF0ZVRlbXBsYXRlKHRlbXBsYXRlQ29uZmlnKTtcclxuXHJcbiAgICAgICAgLy8gY3Z0IHR5cGUg66ek7ZWRIOuTseuhnTogY3Z0Xzxzb3VyY2VDb250YWluZXJJZD5fPHNvdXJjZVRlbXBsYXRlSWQ+IOKGkiBjdnRfPHRhcmdldENvbnRhaW5lcklkPl88bmV3VGVtcGxhdGVJZD5cclxuICAgICAgICB7XHJcbiAgICAgICAgICBjb25zdCBzb3VyY2VDb250YWluZXJJZCA9IHRoaXMuY29udGV4dCEuc291cmNlV29ya3NwYWNlLmNvbnRhaW5lcklkO1xyXG4gICAgICAgICAgY29uc3QgdGFyZ2V0Q29udGFpbmVySWQgPSB0aGlzLmNvbnRleHQhLnRhcmdldFdvcmtzcGFjZS5jb250YWluZXJJZDtcclxuICAgICAgICAgIGNvbnN0IHRhcmdldEN2dFR5cGUgPSBgY3Z0XyR7dGFyZ2V0Q29udGFpbmVySWR9XyR7cmVzdWx0LnRlbXBsYXRlSWR9YDtcclxuXHJcbiAgICAgICAgICAvLyAxLiBDb250YWluZXItc3BlY2lmaWMgdHlwZSBtYXBwaW5nIChjdnRfMTcyOTkwNzU3XzE5NSDihpIgY3Z0XzIxMDkyNjMzMV9YWClcclxuICAgICAgICAgIGNvbnN0IHNvdXJjZUN2dFR5cGUgPSBgY3Z0XyR7c291cmNlQ29udGFpbmVySWR9XyR7c3RlcC5vcmlnaW5hbElkfWA7XHJcbiAgICAgICAgICBpZiAoc291cmNlQ3Z0VHlwZSAhPT0gdGFyZ2V0Q3Z0VHlwZSkge1xyXG4gICAgICAgICAgICB0aGlzLmlkTWFwcGVyLmFkZFRlbXBsYXRlVHlwZU1hcHBpbmcoc291cmNlQ3Z0VHlwZSwgdGFyZ2V0Q3Z0VHlwZSk7XHJcbiAgICAgICAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ1RlbXBsYXRlIHR5cGUgbWFwcGluZyByZWdpc3RlcmVkIChDUkVBVEUvY29udGFpbmVyKScsIHtcclxuICAgICAgICAgICAgICBvcmlnaW5hbFR5cGU6IHNvdXJjZUN2dFR5cGUsIG5ld1R5cGU6IHRhcmdldEN2dFR5cGVcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gMi4gR2FsbGVyeSBJRCBtYXBwaW5nIChjdnRfS0RER1Ig4oaSIGN2dF8yMTA5MjYzMzFfWFgpXHJcbiAgICAgICAgICBpZiAoc3RlcC5jb25maWcudGVtcGxhdGVEYXRhKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGdhbGxlcnlDdnRNYXRjaCA9IHN0ZXAuY29uZmlnLnRlbXBsYXRlRGF0YS5tYXRjaCgvXCJpZFwiOlxccypcIihjdnRfW15cIl0rKVwiLyk7XHJcbiAgICAgICAgICAgIGlmIChnYWxsZXJ5Q3Z0TWF0Y2ggJiYgZ2FsbGVyeUN2dE1hdGNoWzFdICE9PSAnY3Z0X3RlbXBfcHVibGljX2lkJyAmJiBnYWxsZXJ5Q3Z0TWF0Y2hbMV0gIT09IHRhcmdldEN2dFR5cGUpIHtcclxuICAgICAgICAgICAgICB0aGlzLmlkTWFwcGVyLmFkZFRlbXBsYXRlVHlwZU1hcHBpbmcoZ2FsbGVyeUN2dE1hdGNoWzFdLCB0YXJnZXRDdnRUeXBlKTtcclxuICAgICAgICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKCdUZW1wbGF0ZSB0eXBlIG1hcHBpbmcgcmVnaXN0ZXJlZCAoQ1JFQVRFL2dhbGxlcnkpJywge1xyXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUeXBlOiBnYWxsZXJ5Q3Z0TWF0Y2hbMV0sIG5ld1R5cGU6IHRhcmdldEN2dFR5cGVcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIHR5cGU6IEVudGl0eVR5cGUuVEVNUExBVEUsXHJcbiAgICAgICAgICBvcmlnaW5hbElkOiBzdGVwLm9yaWdpbmFsSWQsXHJcbiAgICAgICAgICBuZXdJZDogcmVzdWx0LnRlbXBsYXRlSWQsXHJcbiAgICAgICAgICBuYW1lOiByZXN1bHQubmFtZVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICBjYXNlIEVudGl0eVR5cGUuVkFSSUFCTEU6XHJcbiAgICAgICAgY29uc3QgdmFyQ29uZmlnID0gdHJhbnNmb3JtZXIudHJhbnNmb3JtVmFyaWFibGUoc3RlcC5jb25maWcsIHsgbmV3TmFtZSB9KTtcclxuICAgICAgICByZXN1bHQgPSBhd2FpdCB0aGlzLm1jcCEuY3JlYXRlVmFyaWFibGUodmFyQ29uZmlnKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgdHlwZTogRW50aXR5VHlwZS5WQVJJQUJMRSxcclxuICAgICAgICAgIG9yaWdpbmFsSWQ6IHN0ZXAub3JpZ2luYWxJZCxcclxuICAgICAgICAgIG5ld0lkOiByZXN1bHQudmFyaWFibGVJZCxcclxuICAgICAgICAgIG5hbWU6IHJlc3VsdC5uYW1lXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgIGNhc2UgRW50aXR5VHlwZS5UUklHR0VSOlxyXG4gICAgICAgIGNvbnN0IHRyaWdnZXJDb25maWcgPSB0cmFuc2Zvcm1lci50cmFuc2Zvcm1UcmlnZ2VyKHN0ZXAuY29uZmlnLCB7IG5ld05hbWUgfSk7XHJcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy5tY3AhLmNyZWF0ZVRyaWdnZXIodHJpZ2dlckNvbmZpZyk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIHR5cGU6IEVudGl0eVR5cGUuVFJJR0dFUixcclxuICAgICAgICAgIG9yaWdpbmFsSWQ6IHN0ZXAub3JpZ2luYWxJZCxcclxuICAgICAgICAgIG5ld0lkOiByZXN1bHQudHJpZ2dlcklkLFxyXG4gICAgICAgICAgbmFtZTogcmVzdWx0Lm5hbWVcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgY2FzZSBFbnRpdHlUeXBlLlRBRzpcclxuICAgICAgICBjb25zdCB0YWdDb25maWcgPSB0cmFuc2Zvcm1lci50cmFuc2Zvcm1UYWcoc3RlcC5jb25maWcsIHsgbmV3TmFtZSB9KTtcclxuICAgICAgICByZXN1bHQgPSBhd2FpdCB0aGlzLm1jcCEuY3JlYXRlVGFnKHRhZ0NvbmZpZyk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIHR5cGU6IEVudGl0eVR5cGUuVEFHLFxyXG4gICAgICAgICAgb3JpZ2luYWxJZDogc3RlcC5vcmlnaW5hbElkLFxyXG4gICAgICAgICAgbmV3SWQ6IHJlc3VsdC50YWdJZCxcclxuICAgICAgICAgIG5hbWU6IHJlc3VsdC5uYW1lXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgdGhyb3cgbmV3IENyZWF0aW9uRXJyb3Ioc3RlcC50eXBlLCBuZXdOYW1lLCAnVW5zdXBwb3J0ZWQgZW50aXR5IHR5cGUnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOykkeuztSDqsoDsgqxcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIGNoZWNrRHVwbGljYXRlKFxyXG4gICAgZW50aXR5VHlwZTogRW50aXR5VHlwZSxcclxuICAgIG5hbWU6IHN0cmluZ1xyXG4gICk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gICAgc3dpdGNoIChlbnRpdHlUeXBlKSB7XHJcbiAgICAgIGNhc2UgRW50aXR5VHlwZS5UQUc6XHJcbiAgICAgICAgcmV0dXJuICEhKGF3YWl0IHRoaXMubWNwIS5maW5kVGFnQnlOYW1lKG5hbWUpKTtcclxuICAgICAgY2FzZSBFbnRpdHlUeXBlLlRSSUdHRVI6XHJcbiAgICAgICAgcmV0dXJuICEhKGF3YWl0IHRoaXMubWNwIS5maW5kVHJpZ2dlckJ5TmFtZShuYW1lKSk7XHJcbiAgICAgIGNhc2UgRW50aXR5VHlwZS5WQVJJQUJMRTpcclxuICAgICAgICByZXR1cm4gISEoYXdhaXQgdGhpcy5tY3AhLmZpbmRWYXJpYWJsZUJ5TmFtZShuYW1lKSk7XHJcbiAgICAgIGNhc2UgRW50aXR5VHlwZS5URU1QTEFURTpcclxuICAgICAgICBpZiAodHlwZW9mIHRoaXMubWNwIS5maW5kVGVtcGxhdGVCeU5hbWUgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgIHJldHVybiAhIShhd2FpdCB0aGlzLm1jcCEuZmluZFRlbXBsYXRlQnlOYW1lKG5hbWUpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOuhpOuwsSDsiJjtlokgKHdpdGggZGV0YWlsZWQgcmVzdWx0IHRyYWNraW5nKVxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgcGVyZm9ybVJvbGxiYWNrKGVudGl0aWVzOiBDcmVhdGVkRW50aXR5W10pOiBQcm9taXNlPFJvbGxiYWNrUmVzdWx0PiB7XHJcbiAgICBjb25zdCByZXN1bHQ6IFJvbGxiYWNrUmVzdWx0ID0ge1xyXG4gICAgICBhdHRlbXB0ZWQ6IGVudGl0aWVzLmxlbmd0aCxcclxuICAgICAgc3VjY2VlZGVkOiAwLFxyXG4gICAgICBmYWlsZWQ6IFtdLFxyXG4gICAgICBpc1BhcnRpYWw6IGZhbHNlXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIOyXreyInOycvOuhnCDsgq3soJwgKOydmOyhtOyEsSDsiJzshJwpXHJcbiAgICBjb25zdCByZXZlcnNlZCA9IFsuLi5lbnRpdGllc10ucmV2ZXJzZSgpO1xyXG5cclxuICAgIGZvciAoY29uc3QgZW50aXR5IG9mIHJldmVyc2VkKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgc3dpdGNoIChlbnRpdHkudHlwZSkge1xyXG4gICAgICAgICAgY2FzZSBFbnRpdHlUeXBlLlRBRzpcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5tY3AhLmRlbGV0ZVRhZyhlbnRpdHkubmV3SWQpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIGNhc2UgRW50aXR5VHlwZS5UUklHR0VSOlxyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLm1jcCEuZGVsZXRlVHJpZ2dlcihlbnRpdHkubmV3SWQpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIGNhc2UgRW50aXR5VHlwZS5WQVJJQUJMRTpcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5tY3AhLmRlbGV0ZVZhcmlhYmxlKGVudGl0eS5uZXdJZCk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgY2FzZSBFbnRpdHlUeXBlLlRFTVBMQVRFOlxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMubWNwIS5kZWxldGVUZW1wbGF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMubWNwIS5kZWxldGVUZW1wbGF0ZShlbnRpdHkubmV3SWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXN1bHQuc3VjY2VlZGVkKys7XHJcbiAgICAgICAgdGhpcy5sb2dnZXIuaW5mbygnUm9sbGVkIGJhY2sgZW50aXR5JywgeyBpZDogZW50aXR5Lm5ld0lkLCB0eXBlOiBlbnRpdHkudHlwZSwgbmFtZTogZW50aXR5Lm5hbWUgfSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICByZXN1bHQuZmFpbGVkLnB1c2goe1xyXG4gICAgICAgICAgZW50aXR5SWQ6IGVudGl0eS5uZXdJZCxcclxuICAgICAgICAgIGVudGl0eVR5cGU6IGVudGl0eS50eXBlLFxyXG4gICAgICAgICAgZXJyb3I6IGVycm9yPy5tZXNzYWdlIHx8IFN0cmluZyhlcnJvcilcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcignRmFpbGVkIHRvIHJvbGxiYWNrIGVudGl0eScsIHsgZW50aXR5LCBlcnJvcjogZXJyb3I/Lm1lc3NhZ2UgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXN1bHQuaXNQYXJ0aWFsID0gcmVzdWx0LmZhaWxlZC5sZW5ndGggPiAwO1xyXG5cclxuICAgIGlmIChyZXN1bHQuaXNQYXJ0aWFsKSB7XHJcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oJ1BhcnRpYWwgcm9sbGJhY2sgY29tcGxldGVkJywge1xyXG4gICAgICAgIGF0dGVtcHRlZDogcmVzdWx0LmF0dGVtcHRlZCxcclxuICAgICAgICBzdWNjZWVkZWQ6IHJlc3VsdC5zdWNjZWVkZWQsXHJcbiAgICAgICAgZmFpbGVkOiByZXN1bHQuZmFpbGVkLmxlbmd0aCxcclxuICAgICAgICByZW1haW5pbmdFbnRpdGllczogcmVzdWx0LmZhaWxlZC5tYXAoZiA9PiBgJHtmLmVudGl0eVR5cGV9OiR7Zi5lbnRpdHlJZH1gKVxyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0Z1bGwgcm9sbGJhY2sgY29tcGxldGVkJywge1xyXG4gICAgICAgIGF0dGVtcHRlZDogcmVzdWx0LmF0dGVtcHRlZCxcclxuICAgICAgICBzdWNjZWVkZWQ6IHJlc3VsdC5zdWNjZWVkZWRcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIElEIE1hcHBlciDrsJjtmZhcclxuICAgKi9cclxuICBnZXRJZE1hcHBlcigpOiBJZE1hcHBlciB7XHJcbiAgICByZXR1cm4gdGhpcy5pZE1hcHBlcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIElEIE1hcHBlciDstIjquLDtmZRcclxuICAgKi9cclxuICByZXNldElkTWFwcGVyKCk6IHZvaWQge1xyXG4gICAgdGhpcy5pZE1hcHBlci5jbGVhcigpO1xyXG4gIH1cclxufVxyXG4iXX0=