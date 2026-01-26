/**
 * GTM Agent System
 *
 * GTM Multi-Agent System for tag replication
 *
 * @example
 * ```typescript
 * import {
 *   WorkflowRunner,
 *   AnalyzerAgent,
 *   BuilderAgent,
 *   createMCPAdapter
 * } from 'gtm-agent-system';
 *
 * // Create workflow runner
 * const runner = new WorkflowRunner('session-123');
 *
 * // Initialize with MCP call function
 * runner.initialize(mcpCall, sourceContext, targetContext);
 *
 * // Run replication
 * const result = await runner.runReplication(
 *   { tagIds: ['123', '456'] },
 *   { dryRun: false }
 * );
 * ```
 */
export * from './types';
export { WorkflowRunner, WorkflowStateManager, getStateManager, removeStateManager, clearAllStateManagers } from './orchestrator';
export { BaseAgent } from './agents/base';
export { AnalyzerAgent } from './agents/analyzer';
export type { AnalysisData } from './agents/analyzer';
export { NamingAgent } from './agents/naming';
export { BuilderAgent } from './agents/builder';
export { ValidatorAgent } from './agents/validator';
export { PlannerAgent } from './agents/planner';
export { GTMMCPAdapterImpl, createMCPAdapter } from './adapters/mcp-adapter';
export type { MCPCallFn, MCPCallOptions } from './adapters/mcp-adapter';
export { Logger, LogLevel, logger, createAgentLogger } from './utils/logger';
export type { LogEntry, LoggerOptions } from './utils/logger';
export { AgentException, MCPConnectionError, MCPApiError, NotFoundError, AnalysisError, CircularDependencyError, CreationError, DuplicateNameError, ValidationError, WorkflowAbortedError, InvalidInputError, toAgentError, isAgentException, isRecoverable } from './utils/error';
