/**
 * Base Agent
 * 모든 Agent의 기본 클래스
 */
import { AgentRole, AgentContext, AgentRequest, AgentResponse, AgentEventHandler, AgentEventType } from '../types/agent';
import { Logger } from '../utils/logger';
import { GTMMCPAdapterImpl } from '../adapters/mcp-adapter';
export declare abstract class BaseAgent {
    protected readonly role: AgentRole;
    protected readonly logger: Logger;
    protected context?: AgentContext;
    protected mcp?: GTMMCPAdapterImpl;
    private eventHandlers;
    constructor(role: AgentRole);
    /**
     * Agent 초기화
     */
    initialize(context: AgentContext, mcp: GTMMCPAdapterImpl): void;
    /**
     * 요청 처리 (서브클래스에서 구현)
     */
    abstract execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>>;
    /**
     * 안전한 요청 처리 래퍼
     */
    protected safeExecute<T, R>(request: AgentRequest<T>, handler: () => Promise<R>): Promise<AgentResponse<R>>;
    /**
     * 이벤트 핸들러 등록
     */
    onEvent(handler: AgentEventHandler): void;
    /**
     * 이벤트 핸들러 제거
     */
    offEvent(handler: AgentEventHandler): void;
    /**
     * 이벤트 발생
     */
    protected emitEvent(type: AgentEventType, data?: any): void;
    /**
     * 진행 상황 보고
     */
    protected reportProgress(current: number, total: number, description: string): void;
    /**
     * 컨텍스트 검증
     */
    protected validateContext(): void;
    /**
     * Agent 역할 반환
     */
    getRole(): AgentRole;
    /**
     * Agent 상태 반환
     */
    getStatus(): {
        role: AgentRole;
        initialized: boolean;
        sessionId?: string;
    };
}
