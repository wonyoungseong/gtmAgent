/**
 * Base Agent
 * 모든 Agent의 기본 클래스
 */

import {
  AgentRole,
  AgentContext,
  AgentRequest,
  AgentResponse,
  AgentError,
  AgentEvent,
  AgentEventHandler,
  AgentEventType
} from '../types/agent';
import { Logger, createAgentLogger } from '../utils/logger';
import { toAgentError } from '../utils/error';
import { GTMMCPAdapterImpl } from '../adapters/mcp-adapter';

export abstract class BaseAgent {
  protected readonly role: AgentRole;
  protected readonly logger: Logger;
  protected context?: AgentContext;
  protected mcp?: GTMMCPAdapterImpl;
  private eventHandlers: AgentEventHandler[] = [];

  constructor(role: AgentRole) {
    this.role = role;
    this.logger = createAgentLogger(role);
  }

  /**
   * Agent 초기화
   */
  initialize(context: AgentContext, mcp: GTMMCPAdapterImpl): void {
    this.context = context;
    this.mcp = mcp;
    this.logger.info('Agent initialized', { sessionId: context.sessionId });
  }

  /**
   * 요청 처리 (서브클래스에서 구현)
   */
  abstract execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>>;

  /**
   * 안전한 요청 처리 래퍼
   */
  protected async safeExecute<T, R>(
    request: AgentRequest<T>,
    handler: () => Promise<R>
  ): Promise<AgentResponse<R>> {
    const startTime = Date.now();
    this.emitEvent('started', { action: request.action });

    try {
      const data = await handler();
      const duration = Date.now() - startTime;

      this.emitEvent('completed', { action: request.action, duration });

      return {
        success: true,
        data,
        metadata: {
          duration,
          apiCalls: 0,
          cacheHits: 0
        }
      };
    } catch (error) {
      const agentError = toAgentError(error, this.role);
      this.logger.error('Execution failed', agentError);
      this.emitEvent('failed', { action: request.action, error: agentError });

      return {
        success: false,
        error: agentError
      };
    }
  }

  /**
   * 이벤트 핸들러 등록
   */
  onEvent(handler: AgentEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * 이벤트 핸들러 제거
   */
  offEvent(handler: AgentEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index !== -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * 이벤트 발생
   */
  protected emitEvent(type: AgentEventType, data?: any): void {
    const event: AgentEvent = {
      type,
      agentRole: this.role,
      timestamp: new Date().toISOString(),
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
   * 진행 상황 보고
   */
  protected reportProgress(current: number, total: number, description: string): void {
    this.emitEvent('progress', {
      current,
      total,
      percentage: Math.round((current / total) * 100),
      description
    });
  }

  /**
   * 컨텍스트 검증
   */
  protected validateContext(): void {
    if (!this.context) {
      throw new Error('Agent not initialized: context is missing');
    }
    if (!this.mcp) {
      throw new Error('Agent not initialized: MCP adapter is missing');
    }
  }

  /**
   * Agent 역할 반환
   */
  getRole(): AgentRole {
    return this.role;
  }

  /**
   * Agent 상태 반환
   */
  getStatus(): { role: AgentRole; initialized: boolean; sessionId?: string } {
    return {
      role: this.role,
      initialized: !!this.context,
      sessionId: this.context?.sessionId
    };
  }
}
