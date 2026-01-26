/**
 * Custom Error Classes
 * Agent 시스템 전용 에러 클래스
 */
import { AgentError, AgentErrorCode, AgentRole } from '../types/agent';
/**
 * 기본 Agent 에러 클래스
 */
export declare class AgentException extends Error {
    readonly code: AgentErrorCode;
    readonly details?: any;
    readonly recoverable: boolean;
    readonly agentRole?: AgentRole;
    constructor(code: AgentErrorCode, message: string, options?: {
        details?: any;
        recoverable?: boolean;
        agentRole?: AgentRole;
    });
    /**
     * AgentError 인터페이스로 변환
     */
    toAgentError(): AgentError;
    /**
     * JSON 직렬화
     */
    toJSON(): object;
}
/**
 * MCP 연결 에러
 */
export declare class MCPConnectionError extends AgentException {
    constructor(message: string, details?: any);
}
/**
 * MCP API 에러
 */
export declare class MCPApiError extends AgentException {
    constructor(message: string, details?: any);
}
/**
 * 엔티티 Not Found 에러
 */
export declare class NotFoundError extends AgentException {
    constructor(entityType: string, identifier: string);
}
/**
 * 분석 실패 에러
 */
export declare class AnalysisError extends AgentException {
    constructor(message: string, details?: any);
}
/**
 * 순환 의존성 에러
 */
export declare class CircularDependencyError extends AgentException {
    constructor(cycle: string[]);
}
/**
 * 엔티티 생성 실패 에러
 */
export declare class CreationError extends AgentException {
    constructor(entityType: string, entityName: string, reason: string, details?: any);
}
/**
 * 이름 중복 에러
 */
export declare class DuplicateNameError extends AgentException {
    constructor(entityType: string, name: string);
}
/**
 * 검증 실패 에러
 */
export declare class ValidationError extends AgentException {
    constructor(message: string, issues: any[]);
}
/**
 * 워크플로우 중단 에러
 */
export declare class WorkflowAbortedError extends AgentException {
    constructor(reason: string, phase?: string);
}
/**
 * 입력값 검증 에러
 */
export declare class InvalidInputError extends AgentException {
    constructor(message: string, field?: string);
}
/**
 * 에러를 AgentError로 변환
 */
export declare function toAgentError(error: unknown, agentRole?: AgentRole): AgentError;
/**
 * 에러 여부 확인
 */
export declare function isAgentException(error: unknown): error is AgentException;
/**
 * 복구 가능 에러 여부
 */
export declare function isRecoverable(error: unknown): boolean;
