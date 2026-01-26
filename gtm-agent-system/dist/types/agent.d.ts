/**
 * Agent Types
 * Agent 인터페이스 및 관련 타입 정의
 */
export type AgentRole = 'orchestrator' | 'analyzer' | 'naming' | 'builder' | 'validator' | 'planner';
export interface AgentContext {
    sessionId: string;
    sourceWorkspace: WorkspaceContext;
    targetWorkspace: WorkspaceContext;
    options?: AgentOptions;
}
export interface WorkspaceContext {
    accountId: string;
    containerId: string;
    workspaceId: string;
    name?: string;
}
export interface AgentOptions {
    dryRun?: boolean;
    verbose?: boolean;
    preserveNotes?: boolean;
    skipValidation?: boolean;
}
export interface AgentMessage {
    type: 'request' | 'response' | 'error' | 'progress';
    from: AgentRole;
    to?: AgentRole;
    timestamp: string;
    payload: any;
}
export interface AgentRequest<T = any> {
    action: string;
    data: T;
    context: AgentContext;
}
export interface AgentResponse<T = any> {
    success: boolean;
    data?: T;
    error?: AgentError;
    metadata?: ResponseMetadata;
}
export interface ResponseMetadata {
    duration: number;
    apiCalls: number;
    cacheHits: number;
}
export interface AgentError {
    code: AgentErrorCode;
    message: string;
    details?: any;
    recoverable: boolean;
    agentRole?: AgentRole;
}
export declare enum AgentErrorCode {
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    INVALID_INPUT = "INVALID_INPUT",
    TIMEOUT = "TIMEOUT",
    MCP_CONNECTION_ERROR = "MCP_CONNECTION_ERROR",
    MCP_API_ERROR = "MCP_API_ERROR",
    MCP_NOT_FOUND = "MCP_NOT_FOUND",
    MCP_PERMISSION_DENIED = "MCP_PERMISSION_DENIED",
    ANALYSIS_FAILED = "ANALYSIS_FAILED",
    CIRCULAR_DEPENDENCY = "CIRCULAR_DEPENDENCY",
    MISSING_DEPENDENCY = "MISSING_DEPENDENCY",
    CREATION_FAILED = "CREATION_FAILED",
    DUPLICATE_NAME = "DUPLICATE_NAME",
    VALIDATION_FAILED = "VALIDATION_FAILED",
    WORKFLOW_ABORTED = "WORKFLOW_ABORTED",
    STATE_INVALID = "STATE_INVALID"
}
export interface AgentCapability {
    name: string;
    description: string;
    mcpTools: string[];
    skills: string[];
}
export declare const AGENT_CAPABILITIES: Record<AgentRole, AgentCapability>;
export type AgentEventType = 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
export interface AgentEvent {
    type: AgentEventType;
    agentRole: AgentRole;
    timestamp: string;
    data?: any;
}
export type AgentEventHandler = (event: AgentEvent) => void;
