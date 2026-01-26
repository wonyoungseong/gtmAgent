/**
 * Agent Types
 * Agent 인터페이스 및 관련 타입 정의
 */

import { EntityType, GTMTag, GTMTrigger, GTMVariable, GTMTemplate } from 'gtm-agent-skills';

// ==================== Agent Base Types ====================

export type AgentRole =
  | 'orchestrator'
  | 'analyzer'
  | 'naming'
  | 'builder'
  | 'validator'
  | 'planner';

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

// ==================== Agent Messages ====================

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

// ==================== Agent Error ====================

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  details?: any;
  recoverable: boolean;
  agentRole?: AgentRole;
}

export enum AgentErrorCode {
  // General
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  TIMEOUT = 'TIMEOUT',

  // MCP Errors
  MCP_CONNECTION_ERROR = 'MCP_CONNECTION_ERROR',
  MCP_API_ERROR = 'MCP_API_ERROR',
  MCP_NOT_FOUND = 'MCP_NOT_FOUND',
  MCP_PERMISSION_DENIED = 'MCP_PERMISSION_DENIED',

  // Analysis Errors
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',

  // Creation Errors
  CREATION_FAILED = 'CREATION_FAILED',
  DUPLICATE_NAME = 'DUPLICATE_NAME',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // Workflow Errors
  WORKFLOW_ABORTED = 'WORKFLOW_ABORTED',
  STATE_INVALID = 'STATE_INVALID'
}

// ==================== Agent Capabilities ====================

export interface AgentCapability {
  name: string;
  description: string;
  mcpTools: string[];
  skills: string[];
}

export const AGENT_CAPABILITIES: Record<AgentRole, AgentCapability> = {
  orchestrator: {
    name: 'Orchestrator Agent',
    description: '워크플로우 조율, 사용자 상호작용, 상태 관리',
    mcpTools: ['gtm_context', 'gtm_workspace'],
    skills: []
  },
  analyzer: {
    name: 'Analyzer Agent',
    description: 'Source 분석, 의존성 그래프 생성',
    mcpTools: ['gtm_tag', 'gtm_trigger', 'gtm_variable', 'gtm_export_full'],
    skills: ['DependencyGraphBuilder', 'ReferenceMatcher']
  },
  naming: {
    name: 'Naming Agent',
    description: '명명 패턴 추출, 새 이름 생성',
    mcpTools: [],
    skills: ['NamingParser']
  },
  builder: {
    name: 'Builder Agent',
    description: 'Target에 엔티티 생성',
    mcpTools: ['gtm_tag', 'gtm_trigger', 'gtm_variable'],
    skills: ['IdMapper', 'ConfigTransformer']
  },
  validator: {
    name: 'Validator Agent',
    description: '생성 결과 검증',
    mcpTools: ['gtm_tag', 'gtm_trigger', 'gtm_variable'],
    skills: ['ValidationChecker']
  },
  planner: {
    name: 'Planner Agent',
    description: '신규 태그 판단, 유사 태그 검색',
    mcpTools: [],
    skills: ['ReferenceMatcher']
  }
};

// ==================== Agent Events ====================

export type AgentEventType =
  | 'started'
  | 'progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentEvent {
  type: AgentEventType;
  agentRole: AgentRole;
  timestamp: string;
  data?: any;
}

export type AgentEventHandler = (event: AgentEvent) => void;
