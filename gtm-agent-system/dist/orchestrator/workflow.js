"use strict";
/**
 * Workflow Definitions
 * 워크플로우 정의 및 실행 로직
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowRunner = void 0;
const agent_1 = require("../types/agent");
const state_1 = require("./state");
const analyzer_1 = require("../agents/analyzer");
const naming_1 = require("../agents/naming");
const builder_1 = require("../agents/builder");
const validator_1 = require("../agents/validator");
const planner_1 = require("../agents/planner");
const mcp_adapter_1 = require("../adapters/mcp-adapter");
const logger_1 = require("../utils/logger");
const error_1 = require("../utils/error");
// ==================== Workflow Runner ====================
class WorkflowRunner {
    constructor(sessionId) {
        this.eventHandlers = [];
        this.sessionId = sessionId;
        this.stateManager = (0, state_1.getStateManager)(sessionId);
        this.logger = (0, logger_1.createAgentLogger)('orchestrator', sessionId);
        // Initialize agents
        this.analyzer = new analyzer_1.AnalyzerAgent();
        this.naming = new naming_1.NamingAgent();
        this.builder = new builder_1.BuilderAgent();
        this.validator = new validator_1.ValidatorAgent();
        this.planner = new planner_1.PlannerAgent();
    }
    /**
     * 워크플로우 초기화
     */
    initialize(mcpCall, sourceContext, targetContext) {
        // Create MCP adapters
        this.sourceAdapter = (0, mcp_adapter_1.createMCPAdapter)(mcpCall, sourceContext, { logger: this.logger });
        this.targetAdapter = (0, mcp_adapter_1.createMCPAdapter)(mcpCall, targetContext, { logger: this.logger });
        const agentContext = {
            sessionId: this.sessionId,
            sourceWorkspace: sourceContext,
            targetWorkspace: targetContext
        };
        // Initialize agents with appropriate adapters
        this.analyzer.initialize(agentContext, this.sourceAdapter);
        this.naming.initialize(agentContext, this.sourceAdapter);
        this.planner.initialize(agentContext, this.targetAdapter);
        this.builder.initialize(agentContext, this.targetAdapter);
        this.validator.initialize(agentContext, this.targetAdapter);
        this.logger.info('Workflow initialized', {
            source: sourceContext,
            target: targetContext
        });
    }
    /**
     * 복제 워크플로우 실행
     */
    async runReplication(selection, config = {}) {
        const startTime = Date.now();
        try {
            // Start workflow
            this.stateManager.start(this.sourceAdapter.getContext(), this.targetAdapter.getContext());
            this.emitEvent('workflow_started', { selection, config });
            // Phase 0: Pre-load target entities (single API call batch to avoid duplicate calls)
            this.logger.info('Pre-loading target entities...');
            const [targetTags, targetTriggers, targetVariables, targetTemplates] = await Promise.all([
                this.targetAdapter.listTags(),
                this.targetAdapter.listTriggers(),
                this.targetAdapter.listVariables(),
                this.targetAdapter.listTemplates()
            ]);
            const targetEntities = {
                tags: targetTags,
                triggers: targetTriggers,
                variables: targetVariables,
                templates: targetTemplates,
                loadedAt: Date.now()
            };
            this.stateManager.dispatch({
                type: 'SET_TARGET_ENTITIES',
                payload: targetEntities
            });
            this.logger.info('Target entities pre-loaded', {
                tags: targetTags.length,
                triggers: targetTriggers.length,
                variables: targetVariables.length,
                templates: targetTemplates.length
            });
            // Phase 1: Analysis
            this.stateManager.transitionTo('analyzing');
            this.emitEvent('phase_changed', { phase: 'analyzing' });
            const analysisResponse = await this.analyzer.execute({
                action: 'analyzeTags',
                data: {
                    tagIds: selection.tagIds,
                    includeAllDependencies: selection.includeAllDependencies
                },
                context: {
                    sessionId: this.sessionId,
                    sourceWorkspace: this.sourceAdapter.getContext(),
                    targetWorkspace: this.targetAdapter.getContext()
                }
            });
            if (!analysisResponse.success || !analysisResponse.data) {
                throw new Error(analysisResponse.error?.message || 'Analysis failed');
            }
            const analysisData = analysisResponse.data;
            this.stateManager.dispatch({
                type: 'SET_ANALYSIS_RESULT',
                payload: analysisData.analysisResult
            });
            this.stateManager.dispatch({
                type: 'SET_SOURCE_ENTITIES',
                payload: analysisData.sourceEntities
            });
            // Phase 2: Naming (optional)
            if (!config.skipNaming) {
                this.stateManager.transitionTo('naming');
                this.emitEvent('phase_changed', { phase: 'naming' });
                const namingResponse = await this.naming.execute({
                    action: 'generateNames',
                    data: {
                        sourceEntities: analysisData.sourceEntities,
                        namePrefix: config.namePrefix,
                        nameSuffix: config.nameSuffix
                    },
                    context: {
                        sessionId: this.sessionId,
                        sourceWorkspace: this.sourceAdapter.getContext(),
                        targetWorkspace: this.targetAdapter.getContext()
                    }
                });
                if (namingResponse.success && namingResponse.data) {
                    const namingData = namingResponse.data;
                    this.stateManager.dispatch({
                        type: 'SET_NAMING_PATTERN',
                        payload: namingData.pattern
                    });
                    this.stateManager.dispatch({
                        type: 'SET_ENTITY_NAME_MAP',
                        payload: namingData.nameMap
                    });
                }
            }
            // Phase 3: Planning
            this.stateManager.transitionTo('planning');
            this.emitEvent('phase_changed', { phase: 'planning' });
            const state = this.stateManager.getState();
            const planResponse = await this.planner.execute({
                action: 'createPlan',
                data: {
                    analysisResult: state.analysisResult,
                    sourceEntities: state.sourceEntities,
                    nameMap: state.entityNameMap,
                    skipExisting: true,
                    // Pass pre-loaded target entities to avoid duplicate API calls
                    targetEntities: state.targetEntities
                },
                context: {
                    sessionId: this.sessionId,
                    sourceWorkspace: this.sourceAdapter.getContext(),
                    targetWorkspace: this.targetAdapter.getContext()
                }
            });
            if (!planResponse.success || !planResponse.data) {
                throw new Error(planResponse.error?.message || 'Planning failed');
            }
            const planData = planResponse.data;
            this.stateManager.dispatch({
                type: 'SET_CREATION_PLAN',
                payload: planData
            });
            // Phase 4: Building
            this.stateManager.transitionTo('building');
            this.emitEvent('phase_changed', { phase: 'building' });
            const buildResponse = await this.builder.execute({
                action: 'build',
                data: {
                    creationPlan: planData,
                    nameMap: state.entityNameMap,
                    dryRun: config.dryRun
                },
                context: {
                    sessionId: this.sessionId,
                    sourceWorkspace: this.sourceAdapter.getContext(),
                    targetWorkspace: this.targetAdapter.getContext()
                }
            });
            if (!buildResponse.success || !buildResponse.data) {
                throw new Error(buildResponse.error?.message || 'Building failed');
            }
            const buildData = buildResponse.data;
            // Log build results for debugging
            this.logger.info('Build phase completed', {
                success: buildData.success,
                createdCount: buildData.createdEntities.length,
                skippedCount: buildData.skippedCount,
                errorCount: buildData.errors?.length || 0
            });
            // Store ID mapping
            this.stateManager.dispatch({
                type: 'SET_ID_MAPPING',
                payload: buildData.idMapping
            });
            // Add created entities to state
            for (const entity of buildData.createdEntities) {
                this.stateManager.dispatch({
                    type: 'ADD_CREATED_ENTITY',
                    payload: entity
                });
                this.emitEvent('entity_created', entity);
            }
            // Add build errors to state (important for debugging!)
            if (buildData.errors && buildData.errors.length > 0) {
                this.logger.warn('Build phase had errors', {
                    errors: buildData.errors
                });
                for (const err of buildData.errors) {
                    this.stateManager.addError({
                        code: agent_1.AgentErrorCode.CREATION_FAILED,
                        message: `Failed to create ${err.entityName}: ${err.error}`,
                        agentRole: 'builder',
                        details: err,
                        recoverable: false
                    });
                }
            }
            // Phase 5: Validation (optional)
            if (!config.skipValidation) {
                this.stateManager.transitionTo('validating');
                this.emitEvent('phase_changed', { phase: 'validating' });
                const validationResponse = await this.validator.execute({
                    action: 'validate',
                    data: {
                        sourceEntities: state.sourceEntities,
                        idMapping: buildData.idMapping
                    },
                    context: {
                        sessionId: this.sessionId,
                        sourceWorkspace: this.sourceAdapter.getContext(),
                        targetWorkspace: this.targetAdapter.getContext()
                    }
                });
                if (validationResponse.success && validationResponse.data) {
                    const validationData = validationResponse.data;
                    this.stateManager.dispatch({
                        type: 'SET_VALIDATION_REPORT',
                        payload: validationData
                    });
                }
            }
            // Complete
            this.stateManager.complete();
            const finalState = this.stateManager.getState();
            const result = this.createResult(finalState, startTime);
            this.emitEvent('workflow_completed', result);
            return result;
        }
        catch (error) {
            const agentError = (0, error_1.toAgentError)(error, 'orchestrator');
            this.stateManager.addError(agentError);
            this.emitEvent('workflow_failed', { error: agentError });
            return this.createErrorResult(agentError, startTime);
        }
    }
    /**
     * 이벤트 핸들러 등록
     */
    onEvent(handler) {
        this.eventHandlers.push(handler);
    }
    /**
     * 이벤트 발생
     */
    emitEvent(type, data) {
        const event = {
            type: type,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            data
        };
        for (const handler of this.eventHandlers) {
            try {
                handler(event);
            }
            catch (error) {
                this.logger.warn('Event handler error', error);
            }
        }
    }
    /**
     * 결과 생성
     */
    createResult(state, startTime) {
        const summary = {
            analyzedCount: state.analysisResult?.summary.total || 0,
            plannedCount: state.creationPlan?.steps.filter(s => s.action === 'CREATE').length || 0,
            createdCount: state.createdEntities.length,
            skippedCount: state.creationPlan?.steps.filter(s => s.action === 'SKIP').length || 0,
            failedCount: state.errors.length
        };
        return {
            success: state.errors.length === 0,
            sessionId: this.sessionId,
            sourceWorkspace: state.sourceWorkspace,
            targetWorkspace: state.targetWorkspace,
            duration: Date.now() - startTime,
            summary,
            createdEntities: state.createdEntities,
            idMapping: state.idMapping || {},
            validationReport: state.validationReport,
            errors: state.errors,
            warnings: state.warnings
        };
    }
    /**
     * 에러 결과 생성
     */
    createErrorResult(error, startTime) {
        const state = this.stateManager.getState();
        return {
            success: false,
            sessionId: this.sessionId,
            sourceWorkspace: state.sourceWorkspace,
            targetWorkspace: state.targetWorkspace,
            duration: Date.now() - startTime,
            summary: {
                analyzedCount: 0,
                plannedCount: 0,
                createdCount: 0,
                skippedCount: 0,
                failedCount: 1
            },
            createdEntities: [],
            idMapping: {},
            errors: [error],
            warnings: []
        };
    }
    /**
     * 상태 조회
     */
    getState() {
        return this.stateManager.getState();
    }
    /**
     * 진행 상황 조회
     */
    getProgress() {
        return this.stateManager.getProgress();
    }
}
exports.WorkflowRunner = WorkflowRunner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2Zsb3cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvb3JjaGVzdHJhdG9yL3dvcmtmbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQVdILDBDQUE4RTtBQUM5RSxtQ0FBZ0U7QUFDaEUsaURBQWlFO0FBQ2pFLDZDQUE2RDtBQUM3RCwrQ0FBOEQ7QUFDOUQsbURBQXFEO0FBQ3JELCtDQUFpRDtBQUNqRCx5REFBeUY7QUFDekYsNENBQTREO0FBQzVELDBDQUE4QztBQUc5Qyw0REFBNEQ7QUFFNUQsTUFBYSxjQUFjO0lBaUJ6QixZQUFZLFNBQWlCO1FBYnJCLGtCQUFhLEdBQTJCLEVBQUUsQ0FBQztRQWNqRCxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztRQUMzQixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUEsdUJBQWUsRUFBQyxTQUFTLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUEsMEJBQWlCLEVBQUMsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRTNELG9CQUFvQjtRQUNwQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksd0JBQWEsRUFBRSxDQUFDO1FBQ3BDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxvQkFBVyxFQUFFLENBQUM7UUFDaEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLHNCQUFZLEVBQUUsQ0FBQztRQUNsQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksMEJBQWMsRUFBRSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxzQkFBWSxFQUFFLENBQUM7SUFDcEMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVSxDQUNSLE9BQWtCLEVBQ2xCLGFBQStCLEVBQy9CLGFBQStCO1FBRS9CLHNCQUFzQjtRQUN0QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUEsOEJBQWdCLEVBQUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxFQUFFLE1B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WUFDZCxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDekIsZUFBZSxFQUFFLEtBQUssQ0FBQyxlQUFlO1lBQ3RDLGVBQWUsRUFBRSxLQUFLLENBQUMsZUFBZTtZQUN0QyxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVM7WUFDaEMsT0FBTyxFQUFFO2dCQUNQLGFBQWEsRUFBRSxDQUFDO2dCQUNoQixZQUFZLEVBQUUsQ0FBQztnQkFDZixZQUFZLEVBQUUsQ0FBQztnQkFDZixZQUFZLEVBQUUsQ0FBQztnQkFDZixXQUFXLEVBQUUsQ0FBQzthQUNmO1lBQ0QsZUFBZSxFQUFFLEVBQUU7WUFDbkIsU0FBUyxFQUFFLEVBQUU7WUFDYixNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUM7WUFDZixRQUFRLEVBQUUsRUFBRTtTQUNiLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3RDLENBQUM7SUFFRDs7T0FFRztJQUNILFdBQVc7UUFDVCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDekMsQ0FBQztDQUNGO0FBdFpELHdDQXNaQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBXb3JrZmxvdyBEZWZpbml0aW9uc1xyXG4gKiDsm4ztgaztlIzroZzsmrAg7KCV7J2YIOuwjyDsi6Ttlokg66Gc7KeBXHJcbiAqL1xyXG5cclxuaW1wb3J0IHtcclxuICBXb3JrZmxvd0NvbmZpZyxcclxuICBXb3JrZmxvd1Jlc3VsdCxcclxuICBXb3JrZmxvd1N1bW1hcnksXHJcbiAgV29ya2Zsb3dFdmVudCxcclxuICBXb3JrZmxvd0V2ZW50SGFuZGxlcixcclxuICBUYWdTZWxlY3Rpb24sXHJcbiAgVGFyZ2V0RW50aXRpZXNcclxufSBmcm9tICcuLi90eXBlcy93b3JrZmxvdyc7XHJcbmltcG9ydCB7IFdvcmtzcGFjZUNvbnRleHQsIEFnZW50RXJyb3IsIEFnZW50RXJyb3JDb2RlIH0gZnJvbSAnLi4vdHlwZXMvYWdlbnQnO1xyXG5pbXBvcnQgeyBXb3JrZmxvd1N0YXRlTWFuYWdlciwgZ2V0U3RhdGVNYW5hZ2VyIH0gZnJvbSAnLi9zdGF0ZSc7XHJcbmltcG9ydCB7IEFuYWx5emVyQWdlbnQsIEFuYWx5c2lzRGF0YSB9IGZyb20gJy4uL2FnZW50cy9hbmFseXplcic7XHJcbmltcG9ydCB7IE5hbWluZ0FnZW50LCBOYW1pbmdSZXN1bHQgfSBmcm9tICcuLi9hZ2VudHMvbmFtaW5nJztcclxuaW1wb3J0IHsgQnVpbGRlckFnZW50LCBCdWlsZFJlc3VsdCB9IGZyb20gJy4uL2FnZW50cy9idWlsZGVyJztcclxuaW1wb3J0IHsgVmFsaWRhdG9yQWdlbnQgfSBmcm9tICcuLi9hZ2VudHMvdmFsaWRhdG9yJztcclxuaW1wb3J0IHsgUGxhbm5lckFnZW50IH0gZnJvbSAnLi4vYWdlbnRzL3BsYW5uZXInO1xyXG5pbXBvcnQgeyBHVE1NQ1BBZGFwdGVySW1wbCwgY3JlYXRlTUNQQWRhcHRlciwgTUNQQ2FsbEZuIH0gZnJvbSAnLi4vYWRhcHRlcnMvbWNwLWFkYXB0ZXInO1xyXG5pbXBvcnQgeyBMb2dnZXIsIGNyZWF0ZUFnZW50TG9nZ2VyIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcclxuaW1wb3J0IHsgdG9BZ2VudEVycm9yIH0gZnJvbSAnLi4vdXRpbHMvZXJyb3InO1xyXG5pbXBvcnQgeyBDcmVhdGlvblBsYW4sIFZhbGlkYXRpb25SZXBvcnQgfSBmcm9tICdndG0tYWdlbnQtc2tpbGxzJztcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09IFdvcmtmbG93IFJ1bm5lciA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuZXhwb3J0IGNsYXNzIFdvcmtmbG93UnVubmVyIHtcclxuICBwcml2YXRlIHNlc3Npb25JZDogc3RyaW5nO1xyXG4gIHByaXZhdGUgc3RhdGVNYW5hZ2VyOiBXb3JrZmxvd1N0YXRlTWFuYWdlcjtcclxuICBwcml2YXRlIGxvZ2dlcjogTG9nZ2VyO1xyXG4gIHByaXZhdGUgZXZlbnRIYW5kbGVyczogV29ya2Zsb3dFdmVudEhhbmRsZXJbXSA9IFtdO1xyXG5cclxuICAvLyBBZ2VudHNcclxuICBwcml2YXRlIGFuYWx5emVyOiBBbmFseXplckFnZW50O1xyXG4gIHByaXZhdGUgbmFtaW5nOiBOYW1pbmdBZ2VudDtcclxuICBwcml2YXRlIGJ1aWxkZXI6IEJ1aWxkZXJBZ2VudDtcclxuICBwcml2YXRlIHZhbGlkYXRvcjogVmFsaWRhdG9yQWdlbnQ7XHJcbiAgcHJpdmF0ZSBwbGFubmVyOiBQbGFubmVyQWdlbnQ7XHJcblxyXG4gIC8vIE1DUCBBZGFwdGVyc1xyXG4gIHByaXZhdGUgc291cmNlQWRhcHRlcj86IEdUTU1DUEFkYXB0ZXJJbXBsO1xyXG4gIHByaXZhdGUgdGFyZ2V0QWRhcHRlcj86IEdUTU1DUEFkYXB0ZXJJbXBsO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzZXNzaW9uSWQ6IHN0cmluZykge1xyXG4gICAgdGhpcy5zZXNzaW9uSWQgPSBzZXNzaW9uSWQ7XHJcbiAgICB0aGlzLnN0YXRlTWFuYWdlciA9IGdldFN0YXRlTWFuYWdlcihzZXNzaW9uSWQpO1xyXG4gICAgdGhpcy5sb2dnZXIgPSBjcmVhdGVBZ2VudExvZ2dlcignb3JjaGVzdHJhdG9yJywgc2Vzc2lvbklkKTtcclxuXHJcbiAgICAvLyBJbml0aWFsaXplIGFnZW50c1xyXG4gICAgdGhpcy5hbmFseXplciA9IG5ldyBBbmFseXplckFnZW50KCk7XHJcbiAgICB0aGlzLm5hbWluZyA9IG5ldyBOYW1pbmdBZ2VudCgpO1xyXG4gICAgdGhpcy5idWlsZGVyID0gbmV3IEJ1aWxkZXJBZ2VudCgpO1xyXG4gICAgdGhpcy52YWxpZGF0b3IgPSBuZXcgVmFsaWRhdG9yQWdlbnQoKTtcclxuICAgIHRoaXMucGxhbm5lciA9IG5ldyBQbGFubmVyQWdlbnQoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOybjO2BrO2UjOuhnOyasCDstIjquLDtmZRcclxuICAgKi9cclxuICBpbml0aWFsaXplKFxyXG4gICAgbWNwQ2FsbDogTUNQQ2FsbEZuLFxyXG4gICAgc291cmNlQ29udGV4dDogV29ya3NwYWNlQ29udGV4dCxcclxuICAgIHRhcmdldENvbnRleHQ6IFdvcmtzcGFjZUNvbnRleHRcclxuICApOiB2b2lkIHtcclxuICAgIC8vIENyZWF0ZSBNQ1AgYWRhcHRlcnNcclxuICAgIHRoaXMuc291cmNlQWRhcHRlciA9IGNyZWF0ZU1DUEFkYXB0ZXIobWNwQ2FsbCwgc291cmNlQ29udGV4dCwgeyBsb2dnZXI6IHRoaXMubG9nZ2VyIH0pO1xyXG4gICAgdGhpcy50YXJnZXRBZGFwdGVyID0gY3JlYXRlTUNQQWRhcHRlcihtY3BDYWxsLCB0YXJnZXRDb250ZXh0LCB7IGxvZ2dlcjogdGhpcy5sb2dnZXIgfSk7XHJcblxyXG4gICAgY29uc3QgYWdlbnRDb250ZXh0ID0ge1xyXG4gICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxyXG4gICAgICBzb3VyY2VXb3Jrc3BhY2U6IHNvdXJjZUNvbnRleHQsXHJcbiAgICAgIHRhcmdldFdvcmtzcGFjZTogdGFyZ2V0Q29udGV4dFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBJbml0aWFsaXplIGFnZW50cyB3aXRoIGFwcHJvcHJpYXRlIGFkYXB0ZXJzXHJcbiAgICB0aGlzLmFuYWx5emVyLmluaXRpYWxpemUoYWdlbnRDb250ZXh0LCB0aGlzLnNvdXJjZUFkYXB0ZXIpO1xyXG4gICAgdGhpcy5uYW1pbmcuaW5pdGlhbGl6ZShhZ2VudENvbnRleHQsIHRoaXMuc291cmNlQWRhcHRlcik7XHJcbiAgICB0aGlzLnBsYW5uZXIuaW5pdGlhbGl6ZShhZ2VudENvbnRleHQsIHRoaXMudGFyZ2V0QWRhcHRlcik7XHJcbiAgICB0aGlzLmJ1aWxkZXIuaW5pdGlhbGl6ZShhZ2VudENvbnRleHQsIHRoaXMudGFyZ2V0QWRhcHRlcik7XHJcbiAgICB0aGlzLnZhbGlkYXRvci5pbml0aWFsaXplKGFnZW50Q29udGV4dCwgdGhpcy50YXJnZXRBZGFwdGVyKTtcclxuXHJcbiAgICB0aGlzLmxvZ2dlci5pbmZvKCdXb3JrZmxvdyBpbml0aWFsaXplZCcsIHtcclxuICAgICAgc291cmNlOiBzb3VyY2VDb250ZXh0LFxyXG4gICAgICB0YXJnZXQ6IHRhcmdldENvbnRleHRcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog67O17KCcIOybjO2BrO2UjOuhnOyasCDsi6TtlolcclxuICAgKi9cclxuICBhc3luYyBydW5SZXBsaWNhdGlvbihcclxuICAgIHNlbGVjdGlvbjogVGFnU2VsZWN0aW9uLFxyXG4gICAgY29uZmlnOiBXb3JrZmxvd0NvbmZpZyA9IHt9XHJcbiAgKTogUHJvbWlzZTxXb3JrZmxvd1Jlc3VsdD4ge1xyXG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBTdGFydCB3b3JrZmxvd1xyXG4gICAgICB0aGlzLnN0YXRlTWFuYWdlci5zdGFydChcclxuICAgICAgICB0aGlzLnNvdXJjZUFkYXB0ZXIhLmdldENvbnRleHQoKSxcclxuICAgICAgICB0aGlzLnRhcmdldEFkYXB0ZXIhLmdldENvbnRleHQoKVxyXG4gICAgICApO1xyXG4gICAgICB0aGlzLmVtaXRFdmVudCgnd29ya2Zsb3dfc3RhcnRlZCcsIHsgc2VsZWN0aW9uLCBjb25maWcgfSk7XHJcblxyXG4gICAgICAvLyBQaGFzZSAwOiBQcmUtbG9hZCB0YXJnZXQgZW50aXRpZXMgKHNpbmdsZSBBUEkgY2FsbCBiYXRjaCB0byBhdm9pZCBkdXBsaWNhdGUgY2FsbHMpXHJcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ1ByZS1sb2FkaW5nIHRhcmdldCBlbnRpdGllcy4uLicpO1xyXG4gICAgICBjb25zdCBbdGFyZ2V0VGFncywgdGFyZ2V0VHJpZ2dlcnMsIHRhcmdldFZhcmlhYmxlcywgdGFyZ2V0VGVtcGxhdGVzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcclxuICAgICAgICB0aGlzLnRhcmdldEFkYXB0ZXIhLmxpc3RUYWdzKCksXHJcbiAgICAgICAgdGhpcy50YXJnZXRBZGFwdGVyIS5saXN0VHJpZ2dlcnMoKSxcclxuICAgICAgICB0aGlzLnRhcmdldEFkYXB0ZXIhLmxpc3RWYXJpYWJsZXMoKSxcclxuICAgICAgICB0aGlzLnRhcmdldEFkYXB0ZXIhLmxpc3RUZW1wbGF0ZXMoKVxyXG4gICAgICBdKTtcclxuXHJcbiAgICAgIGNvbnN0IHRhcmdldEVudGl0aWVzOiBUYXJnZXRFbnRpdGllcyA9IHtcclxuICAgICAgICB0YWdzOiB0YXJnZXRUYWdzLFxyXG4gICAgICAgIHRyaWdnZXJzOiB0YXJnZXRUcmlnZ2VycyxcclxuICAgICAgICB2YXJpYWJsZXM6IHRhcmdldFZhcmlhYmxlcyxcclxuICAgICAgICB0ZW1wbGF0ZXM6IHRhcmdldFRlbXBsYXRlcyxcclxuICAgICAgICBsb2FkZWRBdDogRGF0ZS5ub3coKVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgdGhpcy5zdGF0ZU1hbmFnZXIuZGlzcGF0Y2goe1xyXG4gICAgICAgIHR5cGU6ICdTRVRfVEFSR0VUX0VOVElUSUVTJyxcclxuICAgICAgICBwYXlsb2FkOiB0YXJnZXRFbnRpdGllc1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ1RhcmdldCBlbnRpdGllcyBwcmUtbG9hZGVkJywge1xyXG4gICAgICAgIHRhZ3M6IHRhcmdldFRhZ3MubGVuZ3RoLFxyXG4gICAgICAgIHRyaWdnZXJzOiB0YXJnZXRUcmlnZ2Vycy5sZW5ndGgsXHJcbiAgICAgICAgdmFyaWFibGVzOiB0YXJnZXRWYXJpYWJsZXMubGVuZ3RoLFxyXG4gICAgICAgIHRlbXBsYXRlczogdGFyZ2V0VGVtcGxhdGVzLmxlbmd0aFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIFBoYXNlIDE6IEFuYWx5c2lzXHJcbiAgICAgIHRoaXMuc3RhdGVNYW5hZ2VyLnRyYW5zaXRpb25UbygnYW5hbHl6aW5nJyk7XHJcbiAgICAgIHRoaXMuZW1pdEV2ZW50KCdwaGFzZV9jaGFuZ2VkJywgeyBwaGFzZTogJ2FuYWx5emluZycgfSk7XHJcblxyXG4gICAgICBjb25zdCBhbmFseXNpc1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5hbmFseXplci5leGVjdXRlKHtcclxuICAgICAgICBhY3Rpb246ICdhbmFseXplVGFncycsXHJcbiAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgdGFnSWRzOiBzZWxlY3Rpb24udGFnSWRzLFxyXG4gICAgICAgICAgaW5jbHVkZUFsbERlcGVuZGVuY2llczogc2VsZWN0aW9uLmluY2x1ZGVBbGxEZXBlbmRlbmNpZXNcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbnRleHQ6IHtcclxuICAgICAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXHJcbiAgICAgICAgICBzb3VyY2VXb3Jrc3BhY2U6IHRoaXMuc291cmNlQWRhcHRlciEuZ2V0Q29udGV4dCgpLFxyXG4gICAgICAgICAgdGFyZ2V0V29ya3NwYWNlOiB0aGlzLnRhcmdldEFkYXB0ZXIhLmdldENvbnRleHQoKVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAoIWFuYWx5c2lzUmVzcG9uc2Uuc3VjY2VzcyB8fCAhYW5hbHlzaXNSZXNwb25zZS5kYXRhKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGFuYWx5c2lzUmVzcG9uc2UuZXJyb3I/Lm1lc3NhZ2UgfHwgJ0FuYWx5c2lzIGZhaWxlZCcpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBhbmFseXNpc0RhdGEgPSBhbmFseXNpc1Jlc3BvbnNlLmRhdGEgYXMgQW5hbHlzaXNEYXRhO1xyXG4gICAgICB0aGlzLnN0YXRlTWFuYWdlci5kaXNwYXRjaCh7XHJcbiAgICAgICAgdHlwZTogJ1NFVF9BTkFMWVNJU19SRVNVTFQnLFxyXG4gICAgICAgIHBheWxvYWQ6IGFuYWx5c2lzRGF0YS5hbmFseXNpc1Jlc3VsdFxyXG4gICAgICB9KTtcclxuICAgICAgdGhpcy5zdGF0ZU1hbmFnZXIuZGlzcGF0Y2goe1xyXG4gICAgICAgIHR5cGU6ICdTRVRfU09VUkNFX0VOVElUSUVTJyxcclxuICAgICAgICBwYXlsb2FkOiBhbmFseXNpc0RhdGEuc291cmNlRW50aXRpZXNcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBQaGFzZSAyOiBOYW1pbmcgKG9wdGlvbmFsKVxyXG4gICAgICBpZiAoIWNvbmZpZy5za2lwTmFtaW5nKSB7XHJcbiAgICAgICAgdGhpcy5zdGF0ZU1hbmFnZXIudHJhbnNpdGlvblRvKCduYW1pbmcnKTtcclxuICAgICAgICB0aGlzLmVtaXRFdmVudCgncGhhc2VfY2hhbmdlZCcsIHsgcGhhc2U6ICduYW1pbmcnIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBuYW1pbmdSZXNwb25zZSA9IGF3YWl0IHRoaXMubmFtaW5nLmV4ZWN1dGUoe1xyXG4gICAgICAgICAgYWN0aW9uOiAnZ2VuZXJhdGVOYW1lcycsXHJcbiAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgIHNvdXJjZUVudGl0aWVzOiBhbmFseXNpc0RhdGEuc291cmNlRW50aXRpZXMsXHJcbiAgICAgICAgICAgIG5hbWVQcmVmaXg6IGNvbmZpZy5uYW1lUHJlZml4LFxyXG4gICAgICAgICAgICBuYW1lU3VmZml4OiBjb25maWcubmFtZVN1ZmZpeFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGNvbnRleHQ6IHtcclxuICAgICAgICAgICAgc2Vzc2lvbklkOiB0aGlzLnNlc3Npb25JZCxcclxuICAgICAgICAgICAgc291cmNlV29ya3NwYWNlOiB0aGlzLnNvdXJjZUFkYXB0ZXIhLmdldENvbnRleHQoKSxcclxuICAgICAgICAgICAgdGFyZ2V0V29ya3NwYWNlOiB0aGlzLnRhcmdldEFkYXB0ZXIhLmdldENvbnRleHQoKVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAobmFtaW5nUmVzcG9uc2Uuc3VjY2VzcyAmJiBuYW1pbmdSZXNwb25zZS5kYXRhKSB7XHJcbiAgICAgICAgICBjb25zdCBuYW1pbmdEYXRhID0gbmFtaW5nUmVzcG9uc2UuZGF0YSBhcyBOYW1pbmdSZXN1bHQ7XHJcbiAgICAgICAgICB0aGlzLnN0YXRlTWFuYWdlci5kaXNwYXRjaCh7XHJcbiAgICAgICAgICAgIHR5cGU6ICdTRVRfTkFNSU5HX1BBVFRFUk4nLFxyXG4gICAgICAgICAgICBwYXlsb2FkOiBuYW1pbmdEYXRhLnBhdHRlcm4hXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHRoaXMuc3RhdGVNYW5hZ2VyLmRpc3BhdGNoKHtcclxuICAgICAgICAgICAgdHlwZTogJ1NFVF9FTlRJVFlfTkFNRV9NQVAnLFxyXG4gICAgICAgICAgICBwYXlsb2FkOiBuYW1pbmdEYXRhLm5hbWVNYXBcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gUGhhc2UgMzogUGxhbm5pbmdcclxuICAgICAgdGhpcy5zdGF0ZU1hbmFnZXIudHJhbnNpdGlvblRvKCdwbGFubmluZycpO1xyXG4gICAgICB0aGlzLmVtaXRFdmVudCgncGhhc2VfY2hhbmdlZCcsIHsgcGhhc2U6ICdwbGFubmluZycgfSk7XHJcblxyXG4gICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVNYW5hZ2VyLmdldFN0YXRlKCk7XHJcbiAgICAgIGNvbnN0IHBsYW5SZXNwb25zZSA9IGF3YWl0IHRoaXMucGxhbm5lci5leGVjdXRlKHtcclxuICAgICAgICBhY3Rpb246ICdjcmVhdGVQbGFuJyxcclxuICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICBhbmFseXNpc1Jlc3VsdDogc3RhdGUuYW5hbHlzaXNSZXN1bHQhLFxyXG4gICAgICAgICAgc291cmNlRW50aXRpZXM6IHN0YXRlLnNvdXJjZUVudGl0aWVzISxcclxuICAgICAgICAgIG5hbWVNYXA6IHN0YXRlLmVudGl0eU5hbWVNYXAsXHJcbiAgICAgICAgICBza2lwRXhpc3Rpbmc6IHRydWUsXHJcbiAgICAgICAgICAvLyBQYXNzIHByZS1sb2FkZWQgdGFyZ2V0IGVudGl0aWVzIHRvIGF2b2lkIGR1cGxpY2F0ZSBBUEkgY2FsbHNcclxuICAgICAgICAgIHRhcmdldEVudGl0aWVzOiBzdGF0ZS50YXJnZXRFbnRpdGllc1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY29udGV4dDoge1xyXG4gICAgICAgICAgc2Vzc2lvbklkOiB0aGlzLnNlc3Npb25JZCxcclxuICAgICAgICAgIHNvdXJjZVdvcmtzcGFjZTogdGhpcy5zb3VyY2VBZGFwdGVyIS5nZXRDb250ZXh0KCksXHJcbiAgICAgICAgICB0YXJnZXRXb3Jrc3BhY2U6IHRoaXMudGFyZ2V0QWRhcHRlciEuZ2V0Q29udGV4dCgpXHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmICghcGxhblJlc3BvbnNlLnN1Y2Nlc3MgfHwgIXBsYW5SZXNwb25zZS5kYXRhKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKHBsYW5SZXNwb25zZS5lcnJvcj8ubWVzc2FnZSB8fCAnUGxhbm5pbmcgZmFpbGVkJyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHBsYW5EYXRhID0gcGxhblJlc3BvbnNlLmRhdGEgYXMgQ3JlYXRpb25QbGFuO1xyXG4gICAgICB0aGlzLnN0YXRlTWFuYWdlci5kaXNwYXRjaCh7XHJcbiAgICAgICAgdHlwZTogJ1NFVF9DUkVBVElPTl9QTEFOJyxcclxuICAgICAgICBwYXlsb2FkOiBwbGFuRGF0YVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIFBoYXNlIDQ6IEJ1aWxkaW5nXHJcbiAgICAgIHRoaXMuc3RhdGVNYW5hZ2VyLnRyYW5zaXRpb25UbygnYnVpbGRpbmcnKTtcclxuICAgICAgdGhpcy5lbWl0RXZlbnQoJ3BoYXNlX2NoYW5nZWQnLCB7IHBoYXNlOiAnYnVpbGRpbmcnIH0pO1xyXG5cclxuICAgICAgY29uc3QgYnVpbGRSZXNwb25zZSA9IGF3YWl0IHRoaXMuYnVpbGRlci5leGVjdXRlKHtcclxuICAgICAgICBhY3Rpb246ICdidWlsZCcsXHJcbiAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgY3JlYXRpb25QbGFuOiBwbGFuRGF0YSxcclxuICAgICAgICAgIG5hbWVNYXA6IHN0YXRlLmVudGl0eU5hbWVNYXAsXHJcbiAgICAgICAgICBkcnlSdW46IGNvbmZpZy5kcnlSdW5cclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbnRleHQ6IHtcclxuICAgICAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXHJcbiAgICAgICAgICBzb3VyY2VXb3Jrc3BhY2U6IHRoaXMuc291cmNlQWRhcHRlciEuZ2V0Q29udGV4dCgpLFxyXG4gICAgICAgICAgdGFyZ2V0V29ya3NwYWNlOiB0aGlzLnRhcmdldEFkYXB0ZXIhLmdldENvbnRleHQoKVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAoIWJ1aWxkUmVzcG9uc2Uuc3VjY2VzcyB8fCAhYnVpbGRSZXNwb25zZS5kYXRhKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGJ1aWxkUmVzcG9uc2UuZXJyb3I/Lm1lc3NhZ2UgfHwgJ0J1aWxkaW5nIGZhaWxlZCcpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBidWlsZERhdGEgPSBidWlsZFJlc3BvbnNlLmRhdGEgYXMgQnVpbGRSZXN1bHQ7XHJcblxyXG4gICAgICAvLyBMb2cgYnVpbGQgcmVzdWx0cyBmb3IgZGVidWdnaW5nXHJcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0J1aWxkIHBoYXNlIGNvbXBsZXRlZCcsIHtcclxuICAgICAgICBzdWNjZXNzOiBidWlsZERhdGEuc3VjY2VzcyxcclxuICAgICAgICBjcmVhdGVkQ291bnQ6IGJ1aWxkRGF0YS5jcmVhdGVkRW50aXRpZXMubGVuZ3RoLFxyXG4gICAgICAgIHNraXBwZWRDb3VudDogYnVpbGREYXRhLnNraXBwZWRDb3VudCxcclxuICAgICAgICBlcnJvckNvdW50OiBidWlsZERhdGEuZXJyb3JzPy5sZW5ndGggfHwgMFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIFN0b3JlIElEIG1hcHBpbmdcclxuICAgICAgdGhpcy5zdGF0ZU1hbmFnZXIuZGlzcGF0Y2goe1xyXG4gICAgICAgIHR5cGU6ICdTRVRfSURfTUFQUElORycsXHJcbiAgICAgICAgcGF5bG9hZDogYnVpbGREYXRhLmlkTWFwcGluZ1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIEFkZCBjcmVhdGVkIGVudGl0aWVzIHRvIHN0YXRlXHJcbiAgICAgIGZvciAoY29uc3QgZW50aXR5IG9mIGJ1aWxkRGF0YS5jcmVhdGVkRW50aXRpZXMpIHtcclxuICAgICAgICB0aGlzLnN0YXRlTWFuYWdlci5kaXNwYXRjaCh7XHJcbiAgICAgICAgICB0eXBlOiAnQUREX0NSRUFURURfRU5USVRZJyxcclxuICAgICAgICAgIHBheWxvYWQ6IGVudGl0eVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuZW1pdEV2ZW50KCdlbnRpdHlfY3JlYXRlZCcsIGVudGl0eSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFkZCBidWlsZCBlcnJvcnMgdG8gc3RhdGUgKGltcG9ydGFudCBmb3IgZGVidWdnaW5nISlcclxuICAgICAgaWYgKGJ1aWxkRGF0YS5lcnJvcnMgJiYgYnVpbGREYXRhLmVycm9ycy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgdGhpcy5sb2dnZXIud2FybignQnVpbGQgcGhhc2UgaGFkIGVycm9ycycsIHtcclxuICAgICAgICAgIGVycm9yczogYnVpbGREYXRhLmVycm9yc1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGZvciAoY29uc3QgZXJyIG9mIGJ1aWxkRGF0YS5lcnJvcnMpIHtcclxuICAgICAgICAgIHRoaXMuc3RhdGVNYW5hZ2VyLmFkZEVycm9yKHtcclxuICAgICAgICAgICAgY29kZTogQWdlbnRFcnJvckNvZGUuQ1JFQVRJT05fRkFJTEVELFxyXG4gICAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIGNyZWF0ZSAke2Vyci5lbnRpdHlOYW1lfTogJHtlcnIuZXJyb3J9YCxcclxuICAgICAgICAgICAgYWdlbnRSb2xlOiAnYnVpbGRlcicsXHJcbiAgICAgICAgICAgIGRldGFpbHM6IGVycixcclxuICAgICAgICAgICAgcmVjb3ZlcmFibGU6IGZhbHNlXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFBoYXNlIDU6IFZhbGlkYXRpb24gKG9wdGlvbmFsKVxyXG4gICAgICBpZiAoIWNvbmZpZy5za2lwVmFsaWRhdGlvbikge1xyXG4gICAgICAgIHRoaXMuc3RhdGVNYW5hZ2VyLnRyYW5zaXRpb25UbygndmFsaWRhdGluZycpO1xyXG4gICAgICAgIHRoaXMuZW1pdEV2ZW50KCdwaGFzZV9jaGFuZ2VkJywgeyBwaGFzZTogJ3ZhbGlkYXRpbmcnIH0pO1xyXG5cclxuICAgICAgICBjb25zdCB2YWxpZGF0aW9uUmVzcG9uc2UgPSBhd2FpdCB0aGlzLnZhbGlkYXRvci5leGVjdXRlKHtcclxuICAgICAgICAgIGFjdGlvbjogJ3ZhbGlkYXRlJyxcclxuICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgc291cmNlRW50aXRpZXM6IHN0YXRlLnNvdXJjZUVudGl0aWVzISxcclxuICAgICAgICAgICAgaWRNYXBwaW5nOiBidWlsZERhdGEuaWRNYXBwaW5nXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgY29udGV4dDoge1xyXG4gICAgICAgICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxyXG4gICAgICAgICAgICBzb3VyY2VXb3Jrc3BhY2U6IHRoaXMuc291cmNlQWRhcHRlciEuZ2V0Q29udGV4dCgpLFxyXG4gICAgICAgICAgICB0YXJnZXRXb3Jrc3BhY2U6IHRoaXMudGFyZ2V0QWRhcHRlciEuZ2V0Q29udGV4dCgpXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICh2YWxpZGF0aW9uUmVzcG9uc2Uuc3VjY2VzcyAmJiB2YWxpZGF0aW9uUmVzcG9uc2UuZGF0YSkge1xyXG4gICAgICAgICAgY29uc3QgdmFsaWRhdGlvbkRhdGEgPSB2YWxpZGF0aW9uUmVzcG9uc2UuZGF0YSBhcyBWYWxpZGF0aW9uUmVwb3J0O1xyXG4gICAgICAgICAgdGhpcy5zdGF0ZU1hbmFnZXIuZGlzcGF0Y2goe1xyXG4gICAgICAgICAgICB0eXBlOiAnU0VUX1ZBTElEQVRJT05fUkVQT1JUJyxcclxuICAgICAgICAgICAgcGF5bG9hZDogdmFsaWRhdGlvbkRhdGFcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQ29tcGxldGVcclxuICAgICAgdGhpcy5zdGF0ZU1hbmFnZXIuY29tcGxldGUoKTtcclxuICAgICAgY29uc3QgZmluYWxTdGF0ZSA9IHRoaXMuc3RhdGVNYW5hZ2VyLmdldFN0YXRlKCk7XHJcblxyXG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNyZWF0ZVJlc3VsdChmaW5hbFN0YXRlLCBzdGFydFRpbWUpO1xyXG4gICAgICB0aGlzLmVtaXRFdmVudCgnd29ya2Zsb3dfY29tcGxldGVkJywgcmVzdWx0KTtcclxuXHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zdCBhZ2VudEVycm9yID0gdG9BZ2VudEVycm9yKGVycm9yLCAnb3JjaGVzdHJhdG9yJyk7XHJcbiAgICAgIHRoaXMuc3RhdGVNYW5hZ2VyLmFkZEVycm9yKGFnZW50RXJyb3IpO1xyXG5cclxuICAgICAgdGhpcy5lbWl0RXZlbnQoJ3dvcmtmbG93X2ZhaWxlZCcsIHsgZXJyb3I6IGFnZW50RXJyb3IgfSk7XHJcblxyXG4gICAgICByZXR1cm4gdGhpcy5jcmVhdGVFcnJvclJlc3VsdChhZ2VudEVycm9yLCBzdGFydFRpbWUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7J2067Kk7Yq4IO2VuOuTpOufrCDrk7HroZ1cclxuICAgKi9cclxuICBvbkV2ZW50KGhhbmRsZXI6IFdvcmtmbG93RXZlbnRIYW5kbGVyKTogdm9pZCB7XHJcbiAgICB0aGlzLmV2ZW50SGFuZGxlcnMucHVzaChoYW5kbGVyKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOydtOuypO2KuCDrsJzsg51cclxuICAgKi9cclxuICBwcml2YXRlIGVtaXRFdmVudCh0eXBlOiBzdHJpbmcsIGRhdGE/OiBhbnkpOiB2b2lkIHtcclxuICAgIGNvbnN0IGV2ZW50OiBXb3JrZmxvd0V2ZW50ID0ge1xyXG4gICAgICB0eXBlOiB0eXBlIGFzIGFueSxcclxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXHJcbiAgICAgIGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgZm9yIChjb25zdCBoYW5kbGVyIG9mIHRoaXMuZXZlbnRIYW5kbGVycykge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGhhbmRsZXIoZXZlbnQpO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIHRoaXMubG9nZ2VyLndhcm4oJ0V2ZW50IGhhbmRsZXIgZXJyb3InLCBlcnJvcik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOqysOqzvCDsg53shLFcclxuICAgKi9cclxuICBwcml2YXRlIGNyZWF0ZVJlc3VsdChcclxuICAgIHN0YXRlOiBSZXR1cm5UeXBlPFdvcmtmbG93U3RhdGVNYW5hZ2VyWydnZXRTdGF0ZSddPixcclxuICAgIHN0YXJ0VGltZTogbnVtYmVyXHJcbiAgKTogV29ya2Zsb3dSZXN1bHQge1xyXG4gICAgY29uc3Qgc3VtbWFyeTogV29ya2Zsb3dTdW1tYXJ5ID0ge1xyXG4gICAgICBhbmFseXplZENvdW50OiBzdGF0ZS5hbmFseXNpc1Jlc3VsdD8uc3VtbWFyeS50b3RhbCB8fCAwLFxyXG4gICAgICBwbGFubmVkQ291bnQ6IHN0YXRlLmNyZWF0aW9uUGxhbj8uc3RlcHMuZmlsdGVyKHMgPT4gcy5hY3Rpb24gPT09ICdDUkVBVEUnKS5sZW5ndGggfHwgMCxcclxuICAgICAgY3JlYXRlZENvdW50OiBzdGF0ZS5jcmVhdGVkRW50aXRpZXMubGVuZ3RoLFxyXG4gICAgICBza2lwcGVkQ291bnQ6IHN0YXRlLmNyZWF0aW9uUGxhbj8uc3RlcHMuZmlsdGVyKHMgPT4gcy5hY3Rpb24gPT09ICdTS0lQJykubGVuZ3RoIHx8IDAsXHJcbiAgICAgIGZhaWxlZENvdW50OiBzdGF0ZS5lcnJvcnMubGVuZ3RoXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN1Y2Nlc3M6IHN0YXRlLmVycm9ycy5sZW5ndGggPT09IDAsXHJcbiAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXHJcbiAgICAgIHNvdXJjZVdvcmtzcGFjZTogc3RhdGUuc291cmNlV29ya3NwYWNlLFxyXG4gICAgICB0YXJnZXRXb3Jrc3BhY2U6IHN0YXRlLnRhcmdldFdvcmtzcGFjZSxcclxuICAgICAgZHVyYXRpb246IERhdGUubm93KCkgLSBzdGFydFRpbWUsXHJcbiAgICAgIHN1bW1hcnksXHJcbiAgICAgIGNyZWF0ZWRFbnRpdGllczogc3RhdGUuY3JlYXRlZEVudGl0aWVzLFxyXG4gICAgICBpZE1hcHBpbmc6IHN0YXRlLmlkTWFwcGluZyB8fCB7fSxcclxuICAgICAgdmFsaWRhdGlvblJlcG9ydDogc3RhdGUudmFsaWRhdGlvblJlcG9ydCxcclxuICAgICAgZXJyb3JzOiBzdGF0ZS5lcnJvcnMsXHJcbiAgICAgIHdhcm5pbmdzOiBzdGF0ZS53YXJuaW5nc1xyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOyXkOufrCDqsrDqs7wg7IOd7ISxXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjcmVhdGVFcnJvclJlc3VsdChlcnJvcjogQWdlbnRFcnJvciwgc3RhcnRUaW1lOiBudW1iZXIpOiBXb3JrZmxvd1Jlc3VsdCB7XHJcbiAgICBjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVNYW5hZ2VyLmdldFN0YXRlKCk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXHJcbiAgICAgIHNvdXJjZVdvcmtzcGFjZTogc3RhdGUuc291cmNlV29ya3NwYWNlLFxyXG4gICAgICB0YXJnZXRXb3Jrc3BhY2U6IHN0YXRlLnRhcmdldFdvcmtzcGFjZSxcclxuICAgICAgZHVyYXRpb246IERhdGUubm93KCkgLSBzdGFydFRpbWUsXHJcbiAgICAgIHN1bW1hcnk6IHtcclxuICAgICAgICBhbmFseXplZENvdW50OiAwLFxyXG4gICAgICAgIHBsYW5uZWRDb3VudDogMCxcclxuICAgICAgICBjcmVhdGVkQ291bnQ6IDAsXHJcbiAgICAgICAgc2tpcHBlZENvdW50OiAwLFxyXG4gICAgICAgIGZhaWxlZENvdW50OiAxXHJcbiAgICAgIH0sXHJcbiAgICAgIGNyZWF0ZWRFbnRpdGllczogW10sXHJcbiAgICAgIGlkTWFwcGluZzoge30sXHJcbiAgICAgIGVycm9yczogW2Vycm9yXSxcclxuICAgICAgd2FybmluZ3M6IFtdXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7IOB7YOcIOyhsO2ajFxyXG4gICAqL1xyXG4gIGdldFN0YXRlKCk6IFJldHVyblR5cGU8V29ya2Zsb3dTdGF0ZU1hbmFnZXJbJ2dldFN0YXRlJ10+IHtcclxuICAgIHJldHVybiB0aGlzLnN0YXRlTWFuYWdlci5nZXRTdGF0ZSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7KeE7ZaJIOyDge2ZqSDsobDtmoxcclxuICAgKi9cclxuICBnZXRQcm9ncmVzcygpOiBSZXR1cm5UeXBlPFdvcmtmbG93U3RhdGVNYW5hZ2VyWydnZXRQcm9ncmVzcyddPiB7XHJcbiAgICByZXR1cm4gdGhpcy5zdGF0ZU1hbmFnZXIuZ2V0UHJvZ3Jlc3MoKTtcclxuICB9XHJcbn1cclxuIl19