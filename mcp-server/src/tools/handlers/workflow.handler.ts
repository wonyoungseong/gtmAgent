/**
 * GTM Workflow Handler
 * Agent System WorkflowRunner를 MCP Tool로 노출
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, createErrorResult } from "../types.js";
import { log } from "../../utils/index.js";

// Import handlers for internal routing
import { handleGtmTag } from "./tag.handler.js";
import { handleGtmTrigger } from "./trigger.handler.js";
import { handleGtmVariable } from "./variable.handler.js";
import { handleGtmTemplate } from "./template.handler.js";

// Agent System imports
import {
  WorkflowRunner,
  getStateManager,
  removeStateManager,
  AnalyzerAgent,
  GTMMCPAdapterImpl
} from "gtm-agent-system";
import type { AnalysisData } from "gtm-agent-system";

// ==================== Types ====================

interface WorkflowArgs {
  action: "analyze" | "replicate" | "status";
  sessionId: string;
  sourceAccountId?: string;
  sourceContainerId?: string;
  sourceWorkspaceId?: string;
  targetAccountId?: string;
  targetContainerId?: string;
  targetWorkspaceId?: string;
  tagIds?: string;
  includeAllDependencies?: boolean;
  skipNaming?: boolean;
  skipValidation?: boolean;
  dryRun?: boolean;
  namePrefix?: string;
  nameSuffix?: string;
}

// ==================== Internal MCP Call Function ====================

/**
 * 내부 MCP 호출 함수
 * Agent System이 MCP 도구를 호출할 때 사용
 */
function createInternalMCPCall(tagmanager: tagmanager_v2.Tagmanager) {
  return async (toolName: string, args: Record<string, any>): Promise<any> => {
    log(`[Workflow] Internal MCP call: ${toolName}`, JSON.stringify(args));

    let result: ToolResult;

    switch (toolName) {
      case "gtm_tag":
        result = await handleGtmTag(tagmanager, args);
        break;
      case "gtm_trigger":
        result = await handleGtmTrigger(tagmanager, args);
        break;
      case "gtm_variable":
        result = await handleGtmVariable(tagmanager, args);
        break;
      case "gtm_template":
        result = await handleGtmTemplate(tagmanager, args);
        break;
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    // Parse result text back to object
    if (result.content && result.content[0]?.text) {
      return JSON.parse(result.content[0].text);
    }

    return null;
  };
}

// ==================== Action Handlers ====================

async function handleAnalyze(
  tagmanager: tagmanager_v2.Tagmanager,
  args: WorkflowArgs
): Promise<ToolResult> {
  const {
    sessionId,
    sourceAccountId,
    sourceContainerId,
    sourceWorkspaceId,
    tagIds,
    includeAllDependencies = true
  } = args;

  // Validate required fields
  if (!sourceAccountId || !sourceContainerId || !sourceWorkspaceId) {
    return createErrorResult("Missing required source workspace parameters");
  }

  if (!tagIds) {
    return createErrorResult("Missing tagIds parameter");
  }

  const tagIdList = tagIds.split(",").map(id => id.trim());

  const mcpCall = createInternalMCPCall(tagmanager);

  const runner = new WorkflowRunner(sessionId);
  const sourceContext = {
    accountId: sourceAccountId,
    containerId: sourceContainerId,
    workspaceId: sourceWorkspaceId
  };

  // For analyze, we use source as both source and target (no target needed)
  runner.initialize(mcpCall, sourceContext, sourceContext);

  // Get state manager directly for analysis
  const stateManager = getStateManager(sessionId);
  stateManager.start(sourceContext, sourceContext);
  stateManager.transitionTo("analyzing");

  // Run analyzer agent
  const analyzer = new AnalyzerAgent();
  const adapter = new GTMMCPAdapterImpl(mcpCall, sourceContext);

  analyzer.initialize(
    { sessionId, sourceWorkspace: sourceContext, targetWorkspace: sourceContext },
    adapter
  );

  const response = await analyzer.execute<any, AnalysisData>({
    action: "analyzeTags",
    data: {
      tagIds: tagIdList,
      includeAllDependencies
    },
    context: {
      sessionId,
      sourceWorkspace: sourceContext,
      targetWorkspace: sourceContext
    }
  });

  if (!response.success) {
    return createErrorResult("Analysis failed", response.error);
  }

  const analysisData = response.data as AnalysisData | undefined;

  // Store result in state
  if (analysisData) {
    stateManager.dispatch({
      type: "SET_ANALYSIS_RESULT",
      payload: analysisData.analysisResult
    });
    stateManager.dispatch({
      type: "SET_SOURCE_ENTITIES",
      payload: analysisData.sourceEntities
    });
  }

  return createTextResult({
    success: true,
    sessionId,
    phase: "analyzed",
    analysis: analysisData?.analysisResult?.summary,
    creationOrder: analysisData?.analysisResult?.creationOrder,
    entities: {
      tags: analysisData?.sourceEntities?.tags?.length || 0,
      triggers: analysisData?.sourceEntities?.triggers?.length || 0,
      variables: analysisData?.sourceEntities?.variables?.length || 0
    }
  });
}

async function handleReplicate(
  tagmanager: tagmanager_v2.Tagmanager,
  args: WorkflowArgs
): Promise<ToolResult> {
  const {
    sessionId,
    sourceAccountId,
    sourceContainerId,
    sourceWorkspaceId,
    targetAccountId,
    targetContainerId,
    targetWorkspaceId,
    tagIds,
    includeAllDependencies = true,
    skipNaming = false,
    skipValidation = false,
    dryRun = false,
    namePrefix,
    nameSuffix
  } = args;

  // Validate required fields
  if (!sourceAccountId || !sourceContainerId || !sourceWorkspaceId) {
    return createErrorResult("Missing required source workspace parameters");
  }

  if (!targetAccountId || !targetContainerId || !targetWorkspaceId) {
    return createErrorResult("Missing required target workspace parameters");
  }

  if (!tagIds) {
    return createErrorResult("Missing tagIds parameter");
  }

  const tagIdList = tagIds.split(",").map(id => id.trim());

  const mcpCall = createInternalMCPCall(tagmanager);

  const sourceContext = {
    accountId: sourceAccountId,
    containerId: sourceContainerId,
    workspaceId: sourceWorkspaceId
  };

  const targetContext = {
    accountId: targetAccountId,
    containerId: targetContainerId,
    workspaceId: targetWorkspaceId
  };

  // Create and initialize workflow runner
  const runner = new WorkflowRunner(sessionId);
  runner.initialize(mcpCall, sourceContext, targetContext);

  // Set up event handler for logging
  runner.onEvent((event) => {
    log(`[Workflow] Event: ${event.type}`, JSON.stringify(event.data || {}));
  });

  // Run full replication workflow
  const result = await runner.runReplication(
    {
      tagIds: tagIdList,
      includeAllDependencies
    },
    {
      skipNaming,
      skipValidation,
      dryRun,
      namePrefix,
      nameSuffix
    }
  );

  // Log detailed result for debugging
  log(`[Workflow] Replicate result:`, JSON.stringify({
    success: result.success,
    summary: result.summary,
    errorCount: result.errors?.length || 0,
    errors: result.errors?.map(e => ({
      code: e.code,
      message: e.message,
      agentRole: e.agentRole,
      details: e.details
    }))
  }, null, 2));

  if (!result.success) {
    return createTextResult({
      success: false,
      sessionId,
      summary: result.summary,
      errors: result.errors?.map(e => ({
        code: e.code || 'UNKNOWN',
        message: e.message,
        agentRole: e.agentRole || 'unknown',
        details: e.details,
        recoverable: e.recoverable
      })),
      warnings: result.warnings,
      createdEntities: result.createdEntities?.map(e => ({
        type: e.type,
        name: e.name,
        originalId: e.originalId,
        newId: e.newId
      })) || [],
      duration: result.duration,
      phase: 'failed'
    });
  }

  return createTextResult({
    success: true,
    sessionId,
    summary: result.summary,
    createdEntities: result.createdEntities.map(e => ({
      type: e.type,
      name: e.name,
      originalId: e.originalId,
      newId: e.newId
    })),
    idMapping: result.idMapping,
    validation: result.validationReport ? {
      valid: result.validationReport.success,
      missingCount: result.validationReport.missing?.length || 0,
      brokenRefsCount: result.validationReport.brokenReferences?.length || 0
    } : null,
    warnings: result.warnings,
    duration: result.duration,
    phase: 'completed'
  });
}

async function handleStatus(args: WorkflowArgs): Promise<ToolResult> {
  const { sessionId } = args;

  try {
    const stateManager = getStateManager(sessionId);
    const state = stateManager.getState();
    const progress = stateManager.getProgress();

    return createTextResult({
      success: true,
      sessionId,
      phase: state.phase,
      progress: {
        currentStep: progress.currentStep,
        totalSteps: progress.totalSteps,
        percentage: progress.percentage
      },
      createdEntities: state.createdEntities.length,
      errors: state.errors.length,
      warnings: state.warnings.length
    });
  } catch (error) {
    return createTextResult({
      success: true,
      sessionId,
      phase: "not_found",
      message: "No workflow found for this session ID"
    });
  }
}

// ==================== Main Handler ====================

export const handleGtmWorkflow = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const workflowArgs = args as unknown as WorkflowArgs;

  if (!workflowArgs.sessionId) {
    return createErrorResult("Missing required sessionId parameter");
  }

  try {
    switch (workflowArgs.action) {
      case "analyze":
        return await handleAnalyze(tagmanager, workflowArgs);

      case "replicate":
        return await handleReplicate(tagmanager, workflowArgs);

      case "status":
        return await handleStatus(workflowArgs);

      default:
        return createErrorResult(`Unknown action: ${workflowArgs.action}`);
    }
  } catch (error) {
    log("[Workflow] Error:", error);
    return createErrorResult("Workflow execution failed", error);
  }
};
