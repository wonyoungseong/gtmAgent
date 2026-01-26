/**
 * Custom Error Classes
 * Agent 시스템 전용 에러 클래스
 */

import { AgentError, AgentErrorCode, AgentRole } from '../types/agent';

/**
 * 기본 Agent 에러 클래스
 */
export class AgentException extends Error {
  public readonly code: AgentErrorCode;
  public readonly details?: any;
  public readonly recoverable: boolean;
  public readonly agentRole?: AgentRole;

  constructor(
    code: AgentErrorCode,
    message: string,
    options?: {
      details?: any;
      recoverable?: boolean;
      agentRole?: AgentRole;
    }
  ) {
    super(message);
    this.name = 'AgentException';
    this.code = code;
    this.details = options?.details;
    this.recoverable = options?.recoverable ?? false;
    this.agentRole = options?.agentRole;

    // Error 스택 트레이스 유지 (Node.js 환경)
    const ErrorWithCapture = Error as typeof Error & { captureStackTrace?: (target: object, ctor: Function) => void };
    if (typeof ErrorWithCapture.captureStackTrace === 'function') {
      ErrorWithCapture.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * AgentError 인터페이스로 변환
   */
  toAgentError(): AgentError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      agentRole: this.agentRole
    };
  }

  /**
   * JSON 직렬화
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      agentRole: this.agentRole
    };
  }
}

/**
 * MCP 연결 에러
 */
export class MCPConnectionError extends AgentException {
  constructor(message: string, details?: any) {
    super(AgentErrorCode.MCP_CONNECTION_ERROR, message, {
      details,
      recoverable: true
    });
    this.name = 'MCPConnectionError';
  }
}

/**
 * MCP API 에러
 */
export class MCPApiError extends AgentException {
  constructor(message: string, details?: any) {
    super(AgentErrorCode.MCP_API_ERROR, message, {
      details,
      recoverable: false
    });
    this.name = 'MCPApiError';
  }
}

/**
 * 엔티티 Not Found 에러
 */
export class NotFoundError extends AgentException {
  constructor(entityType: string, identifier: string) {
    super(
      AgentErrorCode.MCP_NOT_FOUND,
      `${entityType} not found: ${identifier}`,
      { details: { entityType, identifier }, recoverable: false }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * 분석 실패 에러
 */
export class AnalysisError extends AgentException {
  constructor(message: string, details?: any) {
    super(AgentErrorCode.ANALYSIS_FAILED, message, {
      details,
      recoverable: false,
      agentRole: 'analyzer'
    });
    this.name = 'AnalysisError';
  }
}

/**
 * 순환 의존성 에러
 */
export class CircularDependencyError extends AgentException {
  constructor(cycle: string[]) {
    super(
      AgentErrorCode.CIRCULAR_DEPENDENCY,
      `Circular dependency detected: ${cycle.join(' -> ')}`,
      { details: { cycle }, recoverable: false, agentRole: 'analyzer' }
    );
    this.name = 'CircularDependencyError';
  }
}

/**
 * 엔티티 생성 실패 에러
 */
export class CreationError extends AgentException {
  constructor(
    entityType: string,
    entityName: string,
    reason: string,
    details?: any
  ) {
    super(
      AgentErrorCode.CREATION_FAILED,
      `Failed to create ${entityType} "${entityName}": ${reason}`,
      { details: { entityType, entityName, reason, ...details }, recoverable: true, agentRole: 'builder' }
    );
    this.name = 'CreationError';
  }
}

/**
 * 이름 중복 에러
 */
export class DuplicateNameError extends AgentException {
  constructor(entityType: string, name: string) {
    super(
      AgentErrorCode.DUPLICATE_NAME,
      `${entityType} with name "${name}" already exists`,
      { details: { entityType, name }, recoverable: true, agentRole: 'builder' }
    );
    this.name = 'DuplicateNameError';
  }
}

/**
 * 검증 실패 에러
 */
export class ValidationError extends AgentException {
  constructor(message: string, issues: any[]) {
    super(AgentErrorCode.VALIDATION_FAILED, message, {
      details: { issues },
      recoverable: false,
      agentRole: 'validator'
    });
    this.name = 'ValidationError';
  }
}

/**
 * 워크플로우 중단 에러
 */
export class WorkflowAbortedError extends AgentException {
  constructor(reason: string, phase?: string) {
    super(AgentErrorCode.WORKFLOW_ABORTED, `Workflow aborted: ${reason}`, {
      details: { phase },
      recoverable: false,
      agentRole: 'orchestrator'
    });
    this.name = 'WorkflowAbortedError';
  }
}

/**
 * 입력값 검증 에러
 */
export class InvalidInputError extends AgentException {
  constructor(message: string, field?: string) {
    super(AgentErrorCode.INVALID_INPUT, message, {
      details: { field },
      recoverable: true
    });
    this.name = 'InvalidInputError';
  }
}

// ==================== Utility Functions ====================

/**
 * 에러를 AgentError로 변환
 */
export function toAgentError(error: unknown, agentRole?: AgentRole): AgentError {
  if (error instanceof AgentException) {
    return error.toAgentError();
  }

  if (error instanceof Error) {
    return {
      code: AgentErrorCode.UNKNOWN_ERROR,
      message: error.message,
      details: { stack: error.stack },
      recoverable: false,
      agentRole
    };
  }

  return {
    code: AgentErrorCode.UNKNOWN_ERROR,
    message: String(error),
    recoverable: false,
    agentRole
  };
}

/**
 * 에러 여부 확인
 */
export function isAgentException(error: unknown): error is AgentException {
  return error instanceof AgentException;
}

/**
 * 복구 가능 에러 여부
 */
export function isRecoverable(error: unknown): boolean {
  if (error instanceof AgentException) {
    return error.recoverable;
  }
  return false;
}
