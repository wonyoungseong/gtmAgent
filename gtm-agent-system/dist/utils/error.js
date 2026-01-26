"use strict";
/**
 * Custom Error Classes
 * Agent 시스템 전용 에러 클래스
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidInputError = exports.WorkflowAbortedError = exports.ValidationError = exports.DuplicateNameError = exports.CreationError = exports.CircularDependencyError = exports.AnalysisError = exports.NotFoundError = exports.MCPApiError = exports.MCPConnectionError = exports.AgentException = void 0;
exports.toAgentError = toAgentError;
exports.isAgentException = isAgentException;
exports.isRecoverable = isRecoverable;
const agent_1 = require("../types/agent");
/**
 * 기본 Agent 에러 클래스
 */
class AgentException extends Error {
    constructor(code, message, options) {
        super(message);
        this.name = 'AgentException';
        this.code = code;
        this.details = options?.details;
        this.recoverable = options?.recoverable ?? false;
        this.agentRole = options?.agentRole;
        // Error 스택 트레이스 유지 (Node.js 환경)
        const ErrorWithCapture = Error;
        if (typeof ErrorWithCapture.captureStackTrace === 'function') {
            ErrorWithCapture.captureStackTrace(this, this.constructor);
        }
    }
    /**
     * AgentError 인터페이스로 변환
     */
    toAgentError() {
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
    toJSON() {
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
exports.AgentException = AgentException;
/**
 * MCP 연결 에러
 */
class MCPConnectionError extends AgentException {
    constructor(message, details) {
        super(agent_1.AgentErrorCode.MCP_CONNECTION_ERROR, message, {
            details,
            recoverable: true
        });
        this.name = 'MCPConnectionError';
    }
}
exports.MCPConnectionError = MCPConnectionError;
/**
 * MCP API 에러
 */
class MCPApiError extends AgentException {
    constructor(message, details) {
        super(agent_1.AgentErrorCode.MCP_API_ERROR, message, {
            details,
            recoverable: false
        });
        this.name = 'MCPApiError';
    }
}
exports.MCPApiError = MCPApiError;
/**
 * 엔티티 Not Found 에러
 */
class NotFoundError extends AgentException {
    constructor(entityType, identifier) {
        super(agent_1.AgentErrorCode.MCP_NOT_FOUND, `${entityType} not found: ${identifier}`, { details: { entityType, identifier }, recoverable: false });
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
/**
 * 분석 실패 에러
 */
class AnalysisError extends AgentException {
    constructor(message, details) {
        super(agent_1.AgentErrorCode.ANALYSIS_FAILED, message, {
            details,
            recoverable: false,
            agentRole: 'analyzer'
        });
        this.name = 'AnalysisError';
    }
}
exports.AnalysisError = AnalysisError;
/**
 * 순환 의존성 에러
 */
class CircularDependencyError extends AgentException {
    constructor(cycle) {
        super(agent_1.AgentErrorCode.CIRCULAR_DEPENDENCY, `Circular dependency detected: ${cycle.join(' -> ')}`, { details: { cycle }, recoverable: false, agentRole: 'analyzer' });
        this.name = 'CircularDependencyError';
    }
}
exports.CircularDependencyError = CircularDependencyError;
/**
 * 엔티티 생성 실패 에러
 */
class CreationError extends AgentException {
    constructor(entityType, entityName, reason, details) {
        super(agent_1.AgentErrorCode.CREATION_FAILED, `Failed to create ${entityType} "${entityName}": ${reason}`, { details: { entityType, entityName, reason, ...details }, recoverable: true, agentRole: 'builder' });
        this.name = 'CreationError';
    }
}
exports.CreationError = CreationError;
/**
 * 이름 중복 에러
 */
class DuplicateNameError extends AgentException {
    constructor(entityType, name) {
        super(agent_1.AgentErrorCode.DUPLICATE_NAME, `${entityType} with name "${name}" already exists`, { details: { entityType, name }, recoverable: true, agentRole: 'builder' });
        this.name = 'DuplicateNameError';
    }
}
exports.DuplicateNameError = DuplicateNameError;
/**
 * 검증 실패 에러
 */
class ValidationError extends AgentException {
    constructor(message, issues) {
        super(agent_1.AgentErrorCode.VALIDATION_FAILED, message, {
            details: { issues },
            recoverable: false,
            agentRole: 'validator'
        });
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * 워크플로우 중단 에러
 */
class WorkflowAbortedError extends AgentException {
    constructor(reason, phase) {
        super(agent_1.AgentErrorCode.WORKFLOW_ABORTED, `Workflow aborted: ${reason}`, {
            details: { phase },
            recoverable: false,
            agentRole: 'orchestrator'
        });
        this.name = 'WorkflowAbortedError';
    }
}
exports.WorkflowAbortedError = WorkflowAbortedError;
/**
 * 입력값 검증 에러
 */
class InvalidInputError extends AgentException {
    constructor(message, field) {
        super(agent_1.AgentErrorCode.INVALID_INPUT, message, {
            details: { field },
            recoverable: true
        });
        this.name = 'InvalidInputError';
    }
}
exports.InvalidInputError = InvalidInputError;
// ==================== Utility Functions ====================
/**
 * 에러를 AgentError로 변환
 */
function toAgentError(error, agentRole) {
    if (error instanceof AgentException) {
        return error.toAgentError();
    }
    if (error instanceof Error) {
        return {
            code: agent_1.AgentErrorCode.UNKNOWN_ERROR,
            message: error.message,
            details: { stack: error.stack },
            recoverable: false,
            agentRole
        };
    }
    return {
        code: agent_1.AgentErrorCode.UNKNOWN_ERROR,
        message: String(error),
        recoverable: false,
        agentRole
    };
}
/**
 * 에러 여부 확인
 */
function isAgentException(error) {
    return error instanceof AgentException;
}
/**
 * 복구 가능 에러 여부
 */
function isRecoverable(error) {
    if (error instanceof AgentException) {
        return error.recoverable;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvZXJyb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7O0FBbU5ILG9DQXFCQztBQUtELDRDQUVDO0FBS0Qsc0NBS0M7QUF2UEQsMENBQXVFO0FBRXZFOztHQUVHO0FBQ0gsTUFBYSxjQUFlLFNBQVEsS0FBSztJQU12QyxZQUNFLElBQW9CLEVBQ3BCLE9BQWUsRUFDZixPQUlDO1FBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxnQkFBZ0IsQ0FBQztRQUM3QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sRUFBRSxPQUFPLENBQUM7UUFDaEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLEVBQUUsV0FBVyxJQUFJLEtBQUssQ0FBQztRQUNqRCxJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sRUFBRSxTQUFTLENBQUM7UUFFcEMsZ0NBQWdDO1FBQ2hDLE1BQU0sZ0JBQWdCLEdBQUcsS0FBd0YsQ0FBQztRQUNsSCxJQUFJLE9BQU8sZ0JBQWdCLENBQUMsaUJBQWlCLEtBQUssVUFBVSxFQUFFLENBQUM7WUFDN0QsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM3RCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsWUFBWTtRQUNWLE9BQU87WUFDTCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDckIsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO1lBQ3JCLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztZQUM3QixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7U0FDMUIsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FF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QUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBDdXN0b20gRXJyb3IgQ2xhc3Nlc1xyXG4gKiBBZ2VudCDsi5zsiqTthZwg7KCE7JqpIOyXkOufrCDtgbTrnpjsiqRcclxuICovXHJcblxyXG5pbXBvcnQgeyBBZ2VudEVycm9yLCBBZ2VudEVycm9yQ29kZSwgQWdlbnRSb2xlIH0gZnJvbSAnLi4vdHlwZXMvYWdlbnQnO1xyXG5cclxuLyoqXHJcbiAqIOq4sOuzuCBBZ2VudCDsl5Drn6wg7YG0656Y7IqkXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQWdlbnRFeGNlcHRpb24gZXh0ZW5kcyBFcnJvciB7XHJcbiAgcHVibGljIHJlYWRvbmx5IGNvZGU6IEFnZW50RXJyb3JDb2RlO1xyXG4gIHB1YmxpYyByZWFkb25seSBkZXRhaWxzPzogYW55O1xyXG4gIHB1YmxpYyByZWFkb25seSByZWNvdmVyYWJsZTogYm9vbGVhbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgYWdlbnRSb2xlPzogQWdlbnRSb2xlO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGNvZGU6IEFnZW50RXJyb3JDb2RlLFxyXG4gICAgbWVzc2FnZTogc3RyaW5nLFxyXG4gICAgb3B0aW9ucz86IHtcclxuICAgICAgZGV0YWlscz86IGFueTtcclxuICAgICAgcmVjb3ZlcmFibGU/OiBib29sZWFuO1xyXG4gICAgICBhZ2VudFJvbGU/OiBBZ2VudFJvbGU7XHJcbiAgICB9XHJcbiAgKSB7XHJcbiAgICBzdXBlcihtZXNzYWdlKTtcclxuICAgIHRoaXMubmFtZSA9ICdBZ2VudEV4Y2VwdGlvbic7XHJcbiAgICB0aGlzLmNvZGUgPSBjb2RlO1xyXG4gICAgdGhpcy5kZXRhaWxzID0gb3B0aW9ucz8uZGV0YWlscztcclxuICAgIHRoaXMucmVjb3ZlcmFibGUgPSBvcHRpb25zPy5yZWNvdmVyYWJsZSA/PyBmYWxzZTtcclxuICAgIHRoaXMuYWdlbnRSb2xlID0gb3B0aW9ucz8uYWdlbnRSb2xlO1xyXG5cclxuICAgIC8vIEVycm9yIOyKpO2DnSDtirjroIjsnbTsiqQg7Jyg7KeAIChOb2RlLmpzIO2ZmOqyvSlcclxuICAgIGNvbnN0IEVycm9yV2l0aENhcHR1cmUgPSBFcnJvciBhcyB0eXBlb2YgRXJyb3IgJiB7IGNhcHR1cmVTdGFja1RyYWNlPzogKHRhcmdldDogb2JqZWN0LCBjdG9yOiBGdW5jdGlvbikgPT4gdm9pZCB9O1xyXG4gICAgaWYgKHR5cGVvZiBFcnJvcldpdGhDYXB0dXJlLmNhcHR1cmVTdGFja1RyYWNlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIEVycm9yV2l0aENhcHR1cmUuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZ2VudEVycm9yIOyduO2EsO2OmOydtOyKpOuhnCDrs4DtmZhcclxuICAgKi9cclxuICB0b0FnZW50RXJyb3IoKTogQWdlbnRFcnJvciB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBjb2RlOiB0aGlzLmNvZGUsXHJcbiAgICAgIG1lc3NhZ2U6IHRoaXMubWVzc2FnZSxcclxuICAgICAgZGV0YWlsczogdGhpcy5kZXRhaWxzLFxyXG4gICAgICByZWNvdmVyYWJsZTogdGhpcy5yZWNvdmVyYWJsZSxcclxuICAgICAgYWdlbnRSb2xlOiB0aGlzLmFnZW50Um9sZVxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEpTT04g7KeB66Cs7ZmUXHJcbiAgICovXHJcbiAgdG9KU09OKCk6IG9iamVjdCB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBuYW1lOiB0aGlzLm5hbWUsXHJcbiAgICAgIGNvZGU6IHRoaXMuY29kZSxcclxuICAgICAgbWVzc2FnZTogdGhpcy5tZXNzYWdlLFxyXG4gICAgICBkZXRhaWxzOiB0aGlzLmRldGFpbHMsXHJcbiAgICAgIHJlY292ZXJhYmxlOiB0aGlzLnJlY292ZXJhYmxlLFxyXG4gICAgICBhZ2VudFJvbGU6IHRoaXMuYWdlbnRSb2xlXHJcbiAgICB9O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE1DUCDsl7DqsrAg7JeQ65+sXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTUNQQ29ubmVjdGlvbkVycm9yIGV4dGVuZHMgQWdlbnRFeGNlcHRpb24ge1xyXG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgZGV0YWlscz86IGFueSkge1xyXG4gICAgc3VwZXIoQWdlbnRFcnJvckNvZGUuTUNQX0NPTk5FQ1RJT05fRVJST1IsIG1lc3NhZ2UsIHtcclxuICAgICAgZGV0YWlscyxcclxuICAgICAgcmVjb3ZlcmFibGU6IHRydWVcclxuICAgIH0pO1xyXG4gICAgdGhpcy5uYW1lID0gJ01DUENvbm5lY3Rpb25FcnJvcic7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTUNQIEFQSSDsl5Drn6xcclxuICovXHJcbmV4cG9ydCBjbGFzcyBNQ1BBcGlFcnJvciBleHRlbmRzIEFnZW50RXhjZXB0aW9uIHtcclxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIGRldGFpbHM/OiBhbnkpIHtcclxuICAgIHN1cGVyKEFnZW50RXJyb3JDb2RlLk1DUF9BUElfRVJST1IsIG1lc3NhZ2UsIHtcclxuICAgICAgZGV0YWlscyxcclxuICAgICAgcmVjb3ZlcmFibGU6IGZhbHNlXHJcbiAgICB9KTtcclxuICAgIHRoaXMubmFtZSA9ICdNQ1BBcGlFcnJvcic7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICog7JeU7Yuw7YuwIE5vdCBGb3VuZCDsl5Drn6xcclxuICovXHJcbmV4cG9ydCBjbGFzcyBOb3RGb3VuZEVycm9yIGV4dGVuZHMgQWdlbnRFeGNlcHRpb24ge1xyXG4gIGNvbnN0cnVjdG9yKGVudGl0eVR5cGU6IHN0cmluZywgaWRlbnRpZmllcjogc3RyaW5nKSB7XHJcbiAgICBzdXBlcihcclxuICAgICAgQWdlbnRFcnJvckNvZGUuTUNQX05PVF9GT1VORCxcclxuICAgICAgYCR7ZW50aXR5VHlwZX0gbm90IGZvdW5kOiAke2lkZW50aWZpZXJ9YCxcclxuICAgICAgeyBkZXRhaWxzOiB7IGVudGl0eVR5cGUsIGlkZW50aWZpZXIgfSwgcmVjb3ZlcmFibGU6IGZhbHNlIH1cclxuICAgICk7XHJcbiAgICB0aGlzLm5hbWUgPSAnTm90Rm91bmRFcnJvcic7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICog67aE7ISdIOyLpO2MqCDsl5Drn6xcclxuICovXHJcbmV4cG9ydCBjbGFzcyBBbmFseXNpc0Vycm9yIGV4dGVuZHMgQWdlbnRFeGNlcHRpb24ge1xyXG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgZGV0YWlscz86IGFueSkge1xyXG4gICAgc3VwZXIoQWdlbnRFcnJvckNvZGUuQU5BTFlTSVNfRkFJTEVELCBtZXNzYWdlLCB7XHJcbiAgICAgIGRldGFpbHMsXHJcbiAgICAgIHJlY292ZXJhYmxlOiBmYWxzZSxcclxuICAgICAgYWdlbnRSb2xlOiAnYW5hbHl6ZXInXHJcbiAgICB9KTtcclxuICAgIHRoaXMubmFtZSA9ICdBbmFseXNpc0Vycm9yJztcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDsiJztmZgg7J2Y7KG07ISxIOyXkOufrFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIENpcmN1bGFyRGVwZW5kZW5jeUVycm9yIGV4dGVuZHMgQWdlbnRFeGNlcHRpb24ge1xyXG4gIGNvbnN0cnVjdG9yKGN5Y2xlOiBzdHJpbmdbXSkge1xyXG4gICAgc3VwZXIoXHJcbiAgICAgIEFnZW50RXJyb3JDb2RlLkNJUkNVTEFSX0RFUEVOREVOQ1ksXHJcbiAgICAgIGBDaXJjdWxhciBkZXBlbmRlbmN5IGRldGVjdGVkOiAke2N5Y2xlLmpvaW4oJyAtPiAnKX1gLFxyXG4gICAgICB7IGRldGFpbHM6IHsgY3ljbGUgfSwgcmVjb3ZlcmFibGU6IGZhbHNlLCBhZ2VudFJvbGU6ICdhbmFseXplcicgfVxyXG4gICAgKTtcclxuICAgIHRoaXMubmFtZSA9ICdDaXJjdWxhckRlcGVuZGVuY3lFcnJvcic7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICog7JeU7Yuw7YuwIOyDneyEsSDsi6TtjKgg7JeQ65+sXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ3JlYXRpb25FcnJvciBleHRlbmRzIEFnZW50RXhjZXB0aW9uIHtcclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGVudGl0eVR5cGU6IHN0cmluZyxcclxuICAgIGVudGl0eU5hbWU6IHN0cmluZyxcclxuICAgIHJlYXNvbjogc3RyaW5nLFxyXG4gICAgZGV0YWlscz86IGFueVxyXG4gICkge1xyXG4gICAgc3VwZXIoXHJcbiAgICAgIEFnZW50RXJyb3JDb2RlLkNSRUFUSU9OX0ZBSUxFRCxcclxuICAgICAgYEZhaWxlZCB0byBjcmVhdGUgJHtlbnRpdHlUeXBlfSBcIiR7ZW50aXR5TmFtZX1cIjogJHtyZWFzb259YCxcclxuICAgICAgeyBkZXRhaWxzOiB7IGVudGl0eVR5cGUsIGVudGl0eU5hbWUsIHJlYXNvbiwgLi4uZGV0YWlscyB9LCByZWNvdmVyYWJsZTogdHJ1ZSwgYWdlbnRSb2xlOiAnYnVpbGRlcicgfVxyXG4gICAgKTtcclxuICAgIHRoaXMubmFtZSA9ICdDcmVhdGlvbkVycm9yJztcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDsnbTrpoQg7KSR67O1IOyXkOufrFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIER1cGxpY2F0ZU5hbWVFcnJvciBleHRlbmRzIEFnZW50RXhjZXB0aW9uIHtcclxuICBjb25zdHJ1Y3RvcihlbnRpdHlUeXBlOiBzdHJpbmcsIG5hbWU6IHN0cmluZykge1xyXG4gICAgc3VwZXIoXHJcbiAgICAgIEFnZW50RXJyb3JDb2RlLkRVUExJQ0FURV9OQU1FLFxyXG4gICAgICBgJHtlbnRpdHlUeXBlfSB3aXRoIG5hbWUgXCIke25hbWV9XCIgYWxyZWFkeSBleGlzdHNgLFxyXG4gICAgICB7IGRldGFpbHM6IHsgZW50aXR5VHlwZSwgbmFtZSB9LCByZWNvdmVyYWJsZTogdHJ1ZSwgYWdlbnRSb2xlOiAnYnVpbGRlcicgfVxyXG4gICAgKTtcclxuICAgIHRoaXMubmFtZSA9ICdEdXBsaWNhdGVOYW1lRXJyb3InO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIOqygOymnSDsi6TtjKgg7JeQ65+sXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVmFsaWRhdGlvbkVycm9yIGV4dGVuZHMgQWdlbnRFeGNlcHRpb24ge1xyXG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgaXNzdWVzOiBhbnlbXSkge1xyXG4gICAgc3VwZXIoQWdlbnRFcnJvckNvZGUuVkFMSURBVElPTl9GQUlMRUQsIG1lc3NhZ2UsIHtcclxuICAgICAgZGV0YWlsczogeyBpc3N1ZXMgfSxcclxuICAgICAgcmVjb3ZlcmFibGU6IGZhbHNlLFxyXG4gICAgICBhZ2VudFJvbGU6ICd2YWxpZGF0b3InXHJcbiAgICB9KTtcclxuICAgIHRoaXMubmFtZSA9ICdWYWxpZGF0aW9uRXJyb3InO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIOybjO2BrO2UjOuhnOyasCDspJHri6gg7JeQ65+sXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgV29ya2Zsb3dBYm9ydGVkRXJyb3IgZXh0ZW5kcyBBZ2VudEV4Y2VwdGlvbiB7XHJcbiAgY29uc3RydWN0b3IocmVhc29uOiBzdHJpbmcsIHBoYXNlPzogc3RyaW5nKSB7XHJcbiAgICBzdXBlcihBZ2VudEVycm9yQ29kZS5XT1JLRkxPV19BQk9SVEVELCBgV29ya2Zsb3cgYWJvcnRlZDogJHtyZWFzb259YCwge1xyXG4gICAgICBkZXRhaWxzOiB7IHBoYXNlIH0sXHJcbiAgICAgIHJlY292ZXJhYmxlOiBmYWxzZSxcclxuICAgICAgYWdlbnRSb2xlOiAnb3JjaGVzdHJhdG9yJ1xyXG4gICAgfSk7XHJcbiAgICB0aGlzLm5hbWUgPSAnV29ya2Zsb3dBYm9ydGVkRXJyb3InO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIOyeheugpeqwkiDqsoDspp0g7JeQ65+sXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgSW52YWxpZElucHV0RXJyb3IgZXh0ZW5kcyBBZ2VudEV4Y2VwdGlvbiB7XHJcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBmaWVsZD86IHN0cmluZykge1xyXG4gICAgc3VwZXIoQWdlbnRFcnJvckNvZGUuSU5WQUxJRF9JTlBVVCwgbWVzc2FnZSwge1xyXG4gICAgICBkZXRhaWxzOiB7IGZpZWxkIH0sXHJcbiAgICAgIHJlY292ZXJhYmxlOiB0cnVlXHJcbiAgICB9KTtcclxuICAgIHRoaXMubmFtZSA9ICdJbnZhbGlkSW5wdXRFcnJvcic7XHJcbiAgfVxyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBVdGlsaXR5IEZ1bmN0aW9ucyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIOyXkOufrOulvCBBZ2VudEVycm9y66GcIOuzgO2ZmFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHRvQWdlbnRFcnJvcihlcnJvcjogdW5rbm93biwgYWdlbnRSb2xlPzogQWdlbnRSb2xlKTogQWdlbnRFcnJvciB7XHJcbiAgaWYgKGVycm9yIGluc3RhbmNlb2YgQWdlbnRFeGNlcHRpb24pIHtcclxuICAgIHJldHVybiBlcnJvci50b0FnZW50RXJyb3IoKTtcclxuICB9XHJcblxyXG4gIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBjb2RlOiBBZ2VudEVycm9yQ29kZS5VTktOT1dOX0VSUk9SLFxyXG4gICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxyXG4gICAgICBkZXRhaWxzOiB7IHN0YWNrOiBlcnJvci5zdGFjayB9LFxyXG4gICAgICByZWNvdmVyYWJsZTogZmFsc2UsXHJcbiAgICAgIGFnZW50Um9sZVxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBjb2RlOiBBZ2VudEVycm9yQ29kZS5VTktOT1dOX0VSUk9SLFxyXG4gICAgbWVzc2FnZTogU3RyaW5nKGVycm9yKSxcclxuICAgIHJlY292ZXJhYmxlOiBmYWxzZSxcclxuICAgIGFnZW50Um9sZVxyXG4gIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDsl5Drn6wg7Jes67aAIO2ZleyduFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGlzQWdlbnRFeGNlcHRpb24oZXJyb3I6IHVua25vd24pOiBlcnJvciBpcyBBZ2VudEV4Y2VwdGlvbiB7XHJcbiAgcmV0dXJuIGVycm9yIGluc3RhbmNlb2YgQWdlbnRFeGNlcHRpb247XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDrs7Xqtawg6rCA64qlIOyXkOufrCDsl6zrtoBcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpc1JlY292ZXJhYmxlKGVycm9yOiB1bmtub3duKTogYm9vbGVhbiB7XHJcbiAgaWYgKGVycm9yIGluc3RhbmNlb2YgQWdlbnRFeGNlcHRpb24pIHtcclxuICAgIHJldHVybiBlcnJvci5yZWNvdmVyYWJsZTtcclxuICB9XHJcbiAgcmV0dXJuIGZhbHNlO1xyXG59XHJcbiJdfQ==