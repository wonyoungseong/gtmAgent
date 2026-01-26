"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecoverable = exports.isAgentException = exports.toAgentError = exports.InvalidInputError = exports.WorkflowAbortedError = exports.ValidationError = exports.DuplicateNameError = exports.CreationError = exports.CircularDependencyError = exports.AnalysisError = exports.NotFoundError = exports.MCPApiError = exports.MCPConnectionError = exports.AgentException = exports.createAgentLogger = exports.logger = exports.LogLevel = exports.Logger = exports.createMCPAdapter = exports.GTMMCPAdapterImpl = exports.PlannerAgent = exports.ValidatorAgent = exports.BuilderAgent = exports.NamingAgent = exports.AnalyzerAgent = exports.BaseAgent = exports.clearAllStateManagers = exports.removeStateManager = exports.getStateManager = exports.WorkflowStateManager = exports.WorkflowRunner = void 0;
// ==================== Types ====================
__exportStar(require("./types"), exports);
// ==================== Orchestrator ====================
var orchestrator_1 = require("./orchestrator");
Object.defineProperty(exports, "WorkflowRunner", { enumerable: true, get: function () { return orchestrator_1.WorkflowRunner; } });
Object.defineProperty(exports, "WorkflowStateManager", { enumerable: true, get: function () { return orchestrator_1.WorkflowStateManager; } });
Object.defineProperty(exports, "getStateManager", { enumerable: true, get: function () { return orchestrator_1.getStateManager; } });
Object.defineProperty(exports, "removeStateManager", { enumerable: true, get: function () { return orchestrator_1.removeStateManager; } });
Object.defineProperty(exports, "clearAllStateManagers", { enumerable: true, get: function () { return orchestrator_1.clearAllStateManagers; } });
// ==================== Agents ====================
var base_1 = require("./agents/base");
Object.defineProperty(exports, "BaseAgent", { enumerable: true, get: function () { return base_1.BaseAgent; } });
var analyzer_1 = require("./agents/analyzer");
Object.defineProperty(exports, "AnalyzerAgent", { enumerable: true, get: function () { return analyzer_1.AnalyzerAgent; } });
var naming_1 = require("./agents/naming");
Object.defineProperty(exports, "NamingAgent", { enumerable: true, get: function () { return naming_1.NamingAgent; } });
var builder_1 = require("./agents/builder");
Object.defineProperty(exports, "BuilderAgent", { enumerable: true, get: function () { return builder_1.BuilderAgent; } });
var validator_1 = require("./agents/validator");
Object.defineProperty(exports, "ValidatorAgent", { enumerable: true, get: function () { return validator_1.ValidatorAgent; } });
var planner_1 = require("./agents/planner");
Object.defineProperty(exports, "PlannerAgent", { enumerable: true, get: function () { return planner_1.PlannerAgent; } });
// ==================== Adapters ====================
var mcp_adapter_1 = require("./adapters/mcp-adapter");
Object.defineProperty(exports, "GTMMCPAdapterImpl", { enumerable: true, get: function () { return mcp_adapter_1.GTMMCPAdapterImpl; } });
Object.defineProperty(exports, "createMCPAdapter", { enumerable: true, get: function () { return mcp_adapter_1.createMCPAdapter; } });
// ==================== Utilities ====================
var logger_1 = require("./utils/logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return logger_1.LogLevel; } });
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_1.logger; } });
Object.defineProperty(exports, "createAgentLogger", { enumerable: true, get: function () { return logger_1.createAgentLogger; } });
var error_1 = require("./utils/error");
Object.defineProperty(exports, "AgentException", { enumerable: true, get: function () { return error_1.AgentException; } });
Object.defineProperty(exports, "MCPConnectionError", { enumerable: true, get: function () { return error_1.MCPConnectionError; } });
Object.defineProperty(exports, "MCPApiError", { enumerable: true, get: function () { return error_1.MCPApiError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return error_1.NotFoundError; } });
Object.defineProperty(exports, "AnalysisError", { enumerable: true, get: function () { return error_1.AnalysisError; } });
Object.defineProperty(exports, "CircularDependencyError", { enumerable: true, get: function () { return error_1.CircularDependencyError; } });
Object.defineProperty(exports, "CreationError", { enumerable: true, get: function () { return error_1.CreationError; } });
Object.defineProperty(exports, "DuplicateNameError", { enumerable: true, get: function () { return error_1.DuplicateNameError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return error_1.ValidationError; } });
Object.defineProperty(exports, "WorkflowAbortedError", { enumerable: true, get: function () { return error_1.WorkflowAbortedError; } });
Object.defineProperty(exports, "InvalidInputError", { enumerable: true, get: function () { return error_1.InvalidInputError; } });
Object.defineProperty(exports, "toAgentError", { enumerable: true, get: function () { return error_1.toAgentError; } });
Object.defineProperty(exports, "isAgentException", { enumerable: true, get: function () { return error_1.isAgentException; } });
Object.defineProperty(exports, "isRecoverable", { enumerable: true, get: function () { return error_1.isRecoverable; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTBCRzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxrREFBa0Q7QUFDbEQsMENBQXdCO0FBRXhCLHlEQUF5RDtBQUN6RCwrQ0FNd0I7QUFMdEIsOEdBQUEsY0FBYyxPQUFBO0FBQ2Qsb0hBQUEsb0JBQW9CLE9BQUE7QUFDcEIsK0dBQUEsZUFBZSxPQUFBO0FBQ2Ysa0hBQUEsa0JBQWtCLE9BQUE7QUFDbEIscUhBQUEscUJBQXFCLE9BQUE7QUFHdkIsbURBQW1EO0FBQ25ELHNDQUEwQztBQUFqQyxpR0FBQSxTQUFTLE9BQUE7QUFDbEIsOENBQWtEO0FBQXpDLHlHQUFBLGFBQWEsT0FBQTtBQUV0QiwwQ0FBOEM7QUFBckMscUdBQUEsV0FBVyxPQUFBO0FBQ3BCLDRDQUFnRDtBQUF2Qyx1R0FBQSxZQUFZLE9BQUE7QUFDckIsZ0RBQW9EO0FBQTNDLDJHQUFBLGNBQWMsT0FBQTtBQUN2Qiw0Q0FBZ0Q7QUFBdkMsdUdBQUEsWUFBWSxPQUFBO0FBRXJCLHFEQUFxRDtBQUNyRCxzREFHZ0M7QUFGOUIsZ0hBQUEsaUJBQWlCLE9BQUE7QUFDakIsK0dBQUEsZ0JBQWdCLE9BQUE7QUFJbEIsc0RBQXNEO0FBQ3RELHlDQUt3QjtBQUp0QixnR0FBQSxNQUFNLE9BQUE7QUFDTixrR0FBQSxRQUFRLE9BQUE7QUFDUixnR0FBQSxNQUFNLE9BQUE7QUFDTiwyR0FBQSxpQkFBaUIsT0FBQTtBQUluQix1Q0FldUI7QUFkckIsdUdBQUEsY0FBYyxPQUFBO0FBQ2QsMkdBQUEsa0JBQWtCLE9BQUE7QUFDbEIsb0dBQUEsV0FBVyxPQUFBO0FBQ1gsc0dBQUEsYUFBYSxPQUFBO0FBQ2Isc0dBQUEsYUFBYSxPQUFBO0FBQ2IsZ0hBQUEsdUJBQXVCLE9BQUE7QUFDdkIsc0dBQUEsYUFBYSxPQUFBO0FBQ2IsMkdBQUEsa0JBQWtCLE9BQUE7QUFDbEIsd0dBQUEsZUFBZSxPQUFBO0FBQ2YsNkdBQUEsb0JBQW9CLE9BQUE7QUFDcEIsMEdBQUEsaUJBQWlCLE9BQUE7QUFDakIscUdBQUEsWUFBWSxPQUFBO0FBQ1oseUdBQUEsZ0JBQWdCLE9BQUE7QUFDaEIsc0dBQUEsYUFBYSxPQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEdUTSBBZ2VudCBTeXN0ZW1cclxuICpcclxuICogR1RNIE11bHRpLUFnZW50IFN5c3RlbSBmb3IgdGFnIHJlcGxpY2F0aW9uXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYHR5cGVzY3JpcHRcclxuICogaW1wb3J0IHtcclxuICogICBXb3JrZmxvd1J1bm5lcixcclxuICogICBBbmFseXplckFnZW50LFxyXG4gKiAgIEJ1aWxkZXJBZ2VudCxcclxuICogICBjcmVhdGVNQ1BBZGFwdGVyXHJcbiAqIH0gZnJvbSAnZ3RtLWFnZW50LXN5c3RlbSc7XHJcbiAqXHJcbiAqIC8vIENyZWF0ZSB3b3JrZmxvdyBydW5uZXJcclxuICogY29uc3QgcnVubmVyID0gbmV3IFdvcmtmbG93UnVubmVyKCdzZXNzaW9uLTEyMycpO1xyXG4gKlxyXG4gKiAvLyBJbml0aWFsaXplIHdpdGggTUNQIGNhbGwgZnVuY3Rpb25cclxuICogcnVubmVyLmluaXRpYWxpemUobWNwQ2FsbCwgc291cmNlQ29udGV4dCwgdGFyZ2V0Q29udGV4dCk7XHJcbiAqXHJcbiAqIC8vIFJ1biByZXBsaWNhdGlvblxyXG4gKiBjb25zdCByZXN1bHQgPSBhd2FpdCBydW5uZXIucnVuUmVwbGljYXRpb24oXHJcbiAqICAgeyB0YWdJZHM6IFsnMTIzJywgJzQ1NiddIH0sXHJcbiAqICAgeyBkcnlSdW46IGZhbHNlIH1cclxuICogKTtcclxuICogYGBgXHJcbiAqL1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT0gVHlwZXMgPT09PT09PT09PT09PT09PT09PT1cclxuZXhwb3J0ICogZnJvbSAnLi90eXBlcyc7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBPcmNoZXN0cmF0b3IgPT09PT09PT09PT09PT09PT09PT1cclxuZXhwb3J0IHtcclxuICBXb3JrZmxvd1J1bm5lcixcclxuICBXb3JrZmxvd1N0YXRlTWFuYWdlcixcclxuICBnZXRTdGF0ZU1hbmFnZXIsXHJcbiAgcmVtb3ZlU3RhdGVNYW5hZ2VyLFxyXG4gIGNsZWFyQWxsU3RhdGVNYW5hZ2Vyc1xyXG59IGZyb20gJy4vb3JjaGVzdHJhdG9yJztcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09IEFnZW50cyA9PT09PT09PT09PT09PT09PT09PVxyXG5leHBvcnQgeyBCYXNlQWdlbnQgfSBmcm9tICcuL2FnZW50cy9iYXNlJztcclxuZXhwb3J0IHsgQW5hbHl6ZXJBZ2VudCB9IGZyb20gJy4vYWdlbnRzL2FuYWx5emVyJztcclxuZXhwb3J0IHR5cGUgeyBBbmFseXNpc0RhdGEgfSBmcm9tICcuL2FnZW50cy9hbmFseXplcic7XHJcbmV4cG9ydCB7IE5hbWluZ0FnZW50IH0gZnJvbSAnLi9hZ2VudHMvbmFtaW5nJztcclxuZXhwb3J0IHsgQnVpbGRlckFnZW50IH0gZnJvbSAnLi9hZ2VudHMvYnVpbGRlcic7XHJcbmV4cG9ydCB7IFZhbGlkYXRvckFnZW50IH0gZnJvbSAnLi9hZ2VudHMvdmFsaWRhdG9yJztcclxuZXhwb3J0IHsgUGxhbm5lckFnZW50IH0gZnJvbSAnLi9hZ2VudHMvcGxhbm5lcic7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBBZGFwdGVycyA9PT09PT09PT09PT09PT09PT09PVxyXG5leHBvcnQge1xyXG4gIEdUTU1DUEFkYXB0ZXJJbXBsLFxyXG4gIGNyZWF0ZU1DUEFkYXB0ZXJcclxufSBmcm9tICcuL2FkYXB0ZXJzL21jcC1hZGFwdGVyJztcclxuZXhwb3J0IHR5cGUgeyBNQ1BDYWxsRm4sIE1DUENhbGxPcHRpb25zIH0gZnJvbSAnLi9hZGFwdGVycy9tY3AtYWRhcHRlcic7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBVdGlsaXRpZXMgPT09PT09PT09PT09PT09PT09PT1cclxuZXhwb3J0IHtcclxuICBMb2dnZXIsXHJcbiAgTG9nTGV2ZWwsXHJcbiAgbG9nZ2VyLFxyXG4gIGNyZWF0ZUFnZW50TG9nZ2VyXHJcbn0gZnJvbSAnLi91dGlscy9sb2dnZXInO1xyXG5leHBvcnQgdHlwZSB7IExvZ0VudHJ5LCBMb2dnZXJPcHRpb25zIH0gZnJvbSAnLi91dGlscy9sb2dnZXInO1xyXG5cclxuZXhwb3J0IHtcclxuICBBZ2VudEV4Y2VwdGlvbixcclxuICBNQ1BDb25uZWN0aW9uRXJyb3IsXHJcbiAgTUNQQXBpRXJyb3IsXHJcbiAgTm90Rm91bmRFcnJvcixcclxuICBBbmFseXNpc0Vycm9yLFxyXG4gIENpcmN1bGFyRGVwZW5kZW5jeUVycm9yLFxyXG4gIENyZWF0aW9uRXJyb3IsXHJcbiAgRHVwbGljYXRlTmFtZUVycm9yLFxyXG4gIFZhbGlkYXRpb25FcnJvcixcclxuICBXb3JrZmxvd0Fib3J0ZWRFcnJvcixcclxuICBJbnZhbGlkSW5wdXRFcnJvcixcclxuICB0b0FnZW50RXJyb3IsXHJcbiAgaXNBZ2VudEV4Y2VwdGlvbixcclxuICBpc1JlY292ZXJhYmxlXHJcbn0gZnJvbSAnLi91dGlscy9lcnJvcic7XHJcbiJdfQ==