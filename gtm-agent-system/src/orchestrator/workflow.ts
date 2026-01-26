/**
 * Workflow Definitions
 * 워크플로우 정의 및 실행 로직
 */

import {
  WorkflowConfig,
  WorkflowResult,
  WorkflowSummary,
  WorkflowEvent,
  WorkflowEventHandler,
  TagSelection,
  TargetEntities
} from '../types/workflow';
import { WorkspaceContext, AgentError, AgentErrorCode } from '../types/agent';
import { WorkflowStateManager, getStateManager } from './state';
import { AnalyzerAgent, AnalysisData } from '../agents/analyzer';
import { NamingAgent, NamingResult } from '../agents/naming';
import { BuilderAgent, BuildResult } from '../agents/builder';
import { ValidatorAgent } from '../agents/validator';
import { PlannerAgent } from '../agents/planner';
import { GTMMCPAdapterImpl, createMCPAdapter, MCPCallFn } from '../adapters/mcp-adapter';
import { Logger, createAgentLogger } from '../utils/logger';
import { toAgentError } from '../utils/error';
import { CreationPlan, ValidationReport } from 'gtm-agent-skills';

// ==================== Workflow Runner ====================

export class WorkflowRunner {
  private sessionId: string;
  private stateManager: WorkflowStateManager;
  private logger: Logger;
  private eventHandlers: WorkflowEventHandler[] = [];

  // Agents
  private analyzer: AnalyzerAgent;
  private naming: NamingAgent;
  private builder: BuilderAgent;
  private validator: ValidatorAgent;
  private planner: PlannerAgent;

  // MCP Adapters
  private sourceAdapter?: GTMMCPAdapterImpl;
  private targetAdapter?: GTMMCPAdapterImpl;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.stateManager = getStateManager(sessionId);
    this.logger = createAgentLogger('orchestrator', sessionId);

    // Initialize agents
    this.analyzer = new AnalyzerAgent();
    this.naming = new NamingAgent();
    this.builder = new BuilderAgent();
    this.validator = new ValidatorAgent();
    this.planner = new PlannerAgent();
  }

  /**
   * 워크플로우 초기화
   */
  initialize(
    mcpCall: MCPCallFn,
    sourceContext: WorkspaceContext,
    targetContext: WorkspaceContext
  ): void {
    // Create MCP adapters
    this.sourceAdapter = createMCPAdapter(mcpCall, sourceContext, { logger: this.logger });
    this.targetAdapter = createMCPAdapter(mcpCall, targetContext, { logger: this.logger });

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
  async runReplication(
    selection: TagSelection,
    config: WorkflowConfig = {}
  ): Promise<WorkflowResult> {
    const startTime = Date.now();

    try {
      // Start workflow
      this.stateManager.start(
        this.sourceAdapter!.getContext(),
        this.targetAdapter!.getContext()
      );
      this.emitEvent('workflow_started', { selection, config });

      // Phase 0: Pre-load target entities (single API call batch to avoid duplicate calls)
      this.logger.info('Pre-loading target entities...');
      const [targetTags, targetTriggers, targetVariables, targetTemplates] = await Promise.all([
        this.targetAdapter!.listTags(),
        this.targetAdapter!.listTriggers(),
        this.targetAdapter!.listVariables(),
        this.targetAdapter!.listTemplates()
      ]);

      const targetEntities: TargetEntities = {
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
          sourceWorkspace: this.sourceAdapter!.getContext(),
          targetWorkspace: this.targetAdapter!.getContext()
        }
      });

      if (!analysisResponse.success || !analysisResponse.data) {
        throw new Error(analysisResponse.error?.message || 'Analysis failed');
      }

      const analysisData = analysisResponse.data as AnalysisData;
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
            sourceWorkspace: this.sourceAdapter!.getContext(),
            targetWorkspace: this.targetAdapter!.getContext()
          }
        });

        if (namingResponse.success && namingResponse.data) {
          const namingData = namingResponse.data as NamingResult;
          this.stateManager.dispatch({
            type: 'SET_NAMING_PATTERN',
            payload: namingData.pattern!
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
          analysisResult: state.analysisResult!,
          sourceEntities: state.sourceEntities!,
          nameMap: state.entityNameMap,
          skipExisting: true,
          // Pass pre-loaded target entities to avoid duplicate API calls
          targetEntities: state.targetEntities
        },
        context: {
          sessionId: this.sessionId,
          sourceWorkspace: this.sourceAdapter!.getContext(),
          targetWorkspace: this.targetAdapter!.getContext()
        }
      });

      if (!planResponse.success || !planResponse.data) {
        throw new Error(planResponse.error?.message || 'Planning failed');
      }

      const planData = planResponse.data as CreationPlan;
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
          sourceWorkspace: this.sourceAdapter!.getContext(),
          targetWorkspace: this.targetAdapter!.getContext()
        }
      });

      if (!buildResponse.success || !buildResponse.data) {
        throw new Error(buildResponse.error?.message || 'Building failed');
      }

      const buildData = buildResponse.data as BuildResult;

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
            code: AgentErrorCode.CREATION_FAILED,
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
            sourceEntities: state.sourceEntities!,
            idMapping: buildData.idMapping
          },
          context: {
            sessionId: this.sessionId,
            sourceWorkspace: this.sourceAdapter!.getContext(),
            targetWorkspace: this.targetAdapter!.getContext()
          }
        });

        if (validationResponse.success && validationResponse.data) {
          const validationData = validationResponse.data as ValidationReport;
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
    } catch (error) {
      const agentError = toAgentError(error, 'orchestrator');
      this.stateManager.addError(agentError);

      this.emitEvent('workflow_failed', { error: agentError });

      return this.createErrorResult(agentError, startTime);
    }
  }

  /**
   * 이벤트 핸들러 등록
   */
  onEvent(handler: WorkflowEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * 이벤트 발생
   */
  private emitEvent(type: string, data?: any): void {
    const event: WorkflowEvent = {
      type: type as any,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      data
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.warn('Event handler error', error);
      }
    }
  }

  /**
   * 결과 생성
   */
  private createResult(
    state: ReturnType<WorkflowStateManager['getState']>,
    startTime: number
  ): WorkflowResult {
    const summary: WorkflowSummary = {
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
  private createErrorResult(error: AgentError, startTime: number): WorkflowResult {
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
  getState(): ReturnType<WorkflowStateManager['getState']> {
    return this.stateManager.getState();
  }

  /**
   * 진행 상황 조회
   */
  getProgress(): ReturnType<WorkflowStateManager['getProgress']> {
    return this.stateManager.getProgress();
  }
}
