/**
 * Builder Agent
 * Target 워크스페이스에 엔티티 생성
 */

import {
  IdMapper,
  ConfigTransformer,
  extractCreateConfig,
  EntityType,
  GTMTag,
  GTMTrigger,
  GTMVariable,
  GTMTemplate,
  CreationPlan,
  CreationStep,
  CreatedEntity,
  IdMapping
} from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';
import { RollbackResult } from '../types/workflow';
import { CreationError, DuplicateNameError } from '../utils/error';

// ==================== Request/Response Types ====================

export interface BuildRequest {
  creationPlan: CreationPlan;
  nameMap?: Map<string, string>;
  dryRun?: boolean;
}

export interface BuildSingleRequest {
  entityType: EntityType;
  sourceEntity: GTMTag | GTMTrigger | GTMVariable;
  newName?: string;
}

export interface BuildResult {
  success: boolean;
  partialSuccess: boolean;  // Some entities created, but with errors
  createdEntities: CreatedEntity[];
  idMapping: IdMapping;
  skippedCount: number;
  errors: Array<{ entityId: string; entityName: string; error: string }>;
  rollbackResult?: RollbackResult;  // Rollback tracking information
}

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

export class BuilderAgent extends BaseAgent {
  private idMapper: IdMapper;

  constructor() {
    super('builder');
    this.idMapper = new IdMapper();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = RATE_LIMIT.BACKOFF_BASE_MS * Math.pow(2, attempt);
    return Math.min(delay, RATE_LIMIT.BACKOFF_MAX_MS);
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(errorMsg: string): boolean {
    const rateLimitPatterns = [
      '429',
      'rate limit',
      'rate_limit',
      'rateLimit',
      'quota',
      'too many requests',
      'exceeded',
      '403'  // Sometimes quota errors return 403
    ];
    const lowerMsg = errorMsg.toLowerCase();
    return rateLimitPatterns.some(pattern => lowerMsg.includes(pattern.toLowerCase()));
  }

  /**
   * Create entity with automatic retry for rate limit errors
   */
  private async createEntityWithRetry(
    step: CreationStep,
    newName: string,
    transformer: ConfigTransformer
  ): Promise<CreatedEntity> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < RATE_LIMIT.MAX_RETRIES; attempt++) {
      try {
        return await this.createEntity(step, newName, transformer);
      } catch (error: any) {
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
  async execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>> {
    this.validateContext();

    switch (request.action) {
      case 'build':
        return this.build(request.data as BuildRequest) as Promise<AgentResponse<R>>;

      case 'buildSingle':
        return this.buildSingle(request.data as BuildSingleRequest) as Promise<AgentResponse<R>>;

      case 'rollback':
        return this.rollback(request.data as { createdEntities: CreatedEntity[] }) as Promise<AgentResponse<R>>;

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  /**
   * 생성 계획 실행
   */
  private async build(request: BuildRequest): Promise<AgentResponse<BuildResult>> {
    return this.safeExecute(
      { action: 'build', data: request, context: this.context! },
      async () => {
        const { creationPlan, nameMap, dryRun } = request;
        this.idMapper.clear();

        const createdEntities: CreatedEntity[] = [];
        const errors: Array<{ entityId: string; entityName: string; error: string }> = [];
        let skippedCount = 0;
        let rollbackResult: RollbackResult | undefined;

        const transformer = new ConfigTransformer(this.idMapper);
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
              if (step.type === EntityType.TEMPLATE) {
                const sourceContainerId = this.context!.sourceWorkspace.containerId;
                const targetContainerId = this.context!.targetWorkspace.containerId;
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
            } else {
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
          } catch (error: any) {
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
              retriesExhausted: isRateLimit,  // If rate limit error reached here, retries are exhausted
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
      }
    );
  }

  /**
   * 단일 엔티티 생성
   */
  private async buildSingle(
    request: BuildSingleRequest
  ): Promise<AgentResponse<CreatedEntity>> {
    return this.safeExecute(
      { action: 'buildSingle', data: request, context: this.context! },
      async () => {
        const { entityType, sourceEntity, newName } = request;
        const transformer = new ConfigTransformer(this.idMapper);

        const finalName = newName || (sourceEntity as any).name;

        // 중복 검사
        const existing = await this.checkDuplicate(entityType, finalName);
        if (existing) {
          throw new DuplicateNameError(entityType, finalName);
        }

        let config: any;
        let result: any;

        switch (entityType) {
          case EntityType.VARIABLE:
            config = transformer.transformVariable(sourceEntity as GTMVariable, { newName: finalName });
            result = await this.mcp!.createVariable(config);
            return {
              type: EntityType.VARIABLE,
              originalId: (sourceEntity as GTMVariable).variableId,
              newId: result.variableId,
              name: result.name
            };

          case EntityType.TRIGGER:
            config = transformer.transformTrigger(sourceEntity as GTMTrigger, { newName: finalName });
            result = await this.mcp!.createTrigger(config);
            return {
              type: EntityType.TRIGGER,
              originalId: (sourceEntity as GTMTrigger).triggerId,
              newId: result.triggerId,
              name: result.name
            };

          case EntityType.TAG:
            config = transformer.transformTag(sourceEntity as GTMTag, { newName: finalName });
            result = await this.mcp!.createTag(config);
            return {
              type: EntityType.TAG,
              originalId: (sourceEntity as GTMTag).tagId,
              newId: result.tagId,
              name: result.name
            };

          default:
            throw new Error(`Unsupported entity type: ${entityType}`);
        }
      }
    );
  }

  /**
   * 롤백 실행
   */
  private async rollback(
    request: { createdEntities: CreatedEntity[] }
  ): Promise<AgentResponse<RollbackResult>> {
    return this.safeExecute(
      { action: 'rollback', data: request, context: this.context! },
      async () => {
        return await this.performRollback(request.createdEntities);
      }
    );
  }

  /**
   * 엔티티 생성
   */
  private async createEntity(
    step: CreationStep,
    newName: string,
    transformer: ConfigTransformer
  ): Promise<CreatedEntity> {
    // 중복 검사 (템플릿은 별도 처리)
    if (step.type !== EntityType.TEMPLATE) {
      const existing = await this.checkDuplicate(step.type, newName);
      if (existing) {
        throw new DuplicateNameError(step.type, newName);
      }
    }

    let result: any;

    switch (step.type) {
      case EntityType.TEMPLATE:
        // 템플릿 중복 검사
        if (typeof this.mcp!.findTemplateByName === 'function') {
          const existingTemplate = await this.mcp!.findTemplateByName(newName);
          if (existingTemplate) {
            throw new DuplicateNameError(step.type, newName);
          }
        }

        // templateData는 그대로 복사 (LLM 분석 불필요)
        const templateConfig = {
          name: newName,
          templateData: step.config.templateData
          // galleryReference는 복사하지 않음 (새 템플릿으로 생성)
        };

        if (typeof this.mcp!.createTemplate !== 'function') {
          throw new CreationError(step.type, newName, 'Template creation not supported by MCP adapter');
        }

        result = await this.mcp!.createTemplate(templateConfig);

        // cvt type 매핑 등록: cvt_<sourceContainerId>_<sourceTemplateId> → cvt_<targetContainerId>_<newTemplateId>
        {
          const sourceContainerId = this.context!.sourceWorkspace.containerId;
          const targetContainerId = this.context!.targetWorkspace.containerId;
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
          type: EntityType.TEMPLATE,
          originalId: step.originalId,
          newId: result.templateId,
          name: result.name
        };

      case EntityType.VARIABLE:
        const varConfig = transformer.transformVariable(step.config, { newName });
        result = await this.mcp!.createVariable(varConfig);
        return {
          type: EntityType.VARIABLE,
          originalId: step.originalId,
          newId: result.variableId,
          name: result.name
        };

      case EntityType.TRIGGER:
        const triggerConfig = transformer.transformTrigger(step.config, { newName });
        result = await this.mcp!.createTrigger(triggerConfig);
        return {
          type: EntityType.TRIGGER,
          originalId: step.originalId,
          newId: result.triggerId,
          name: result.name
        };

      case EntityType.TAG:
        const tagConfig = transformer.transformTag(step.config, { newName });
        result = await this.mcp!.createTag(tagConfig);
        return {
          type: EntityType.TAG,
          originalId: step.originalId,
          newId: result.tagId,
          name: result.name
        };

      default:
        throw new CreationError(step.type, newName, 'Unsupported entity type');
    }
  }

  /**
   * 중복 검사
   */
  private async checkDuplicate(
    entityType: EntityType,
    name: string
  ): Promise<boolean> {
    switch (entityType) {
      case EntityType.TAG:
        return !!(await this.mcp!.findTagByName(name));
      case EntityType.TRIGGER:
        return !!(await this.mcp!.findTriggerByName(name));
      case EntityType.VARIABLE:
        return !!(await this.mcp!.findVariableByName(name));
      case EntityType.TEMPLATE:
        if (typeof this.mcp!.findTemplateByName === 'function') {
          return !!(await this.mcp!.findTemplateByName(name));
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * 롤백 수행 (with detailed result tracking)
   */
  private async performRollback(entities: CreatedEntity[]): Promise<RollbackResult> {
    const result: RollbackResult = {
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
          case EntityType.TAG:
            await this.mcp!.deleteTag(entity.newId);
            break;
          case EntityType.TRIGGER:
            await this.mcp!.deleteTrigger(entity.newId);
            break;
          case EntityType.VARIABLE:
            await this.mcp!.deleteVariable(entity.newId);
            break;
          case EntityType.TEMPLATE:
            if (typeof this.mcp!.deleteTemplate === 'function') {
              await this.mcp!.deleteTemplate(entity.newId);
            }
            break;
        }
        result.succeeded++;
        this.logger.info('Rolled back entity', { id: entity.newId, type: entity.type, name: entity.name });
      } catch (error: any) {
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
    } else {
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
  getIdMapper(): IdMapper {
    return this.idMapper;
  }

  /**
   * ID Mapper 초기화
   */
  resetIdMapper(): void {
    this.idMapper.clear();
  }
}
