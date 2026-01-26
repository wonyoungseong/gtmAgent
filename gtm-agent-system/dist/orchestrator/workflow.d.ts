/**
 * Workflow Definitions
 * 워크플로우 정의 및 실행 로직
 */
import { WorkflowConfig, WorkflowResult, WorkflowEventHandler, TagSelection } from '../types/workflow';
import { WorkspaceContext } from '../types/agent';
import { WorkflowStateManager } from './state';
import { MCPCallFn } from '../adapters/mcp-adapter';
export declare class WorkflowRunner {
    private sessionId;
    private stateManager;
    private logger;
    private eventHandlers;
    private analyzer;
    private naming;
    private builder;
    private validator;
    private planner;
    private sourceAdapter?;
    private targetAdapter?;
    constructor(sessionId: string);
    /**
     * 워크플로우 초기화
     */
    initialize(mcpCall: MCPCallFn, sourceContext: WorkspaceContext, targetContext: WorkspaceContext): void;
    /**
     * 복제 워크플로우 실행
     */
    runReplication(selection: TagSelection, config?: WorkflowConfig): Promise<WorkflowResult>;
    /**
     * 이벤트 핸들러 등록
     */
    onEvent(handler: WorkflowEventHandler): void;
    /**
     * 이벤트 발생
     */
    private emitEvent;
    /**
     * 결과 생성
     */
    private createResult;
    /**
     * 에러 결과 생성
     */
    private createErrorResult;
    /**
     * 상태 조회
     */
    getState(): ReturnType<WorkflowStateManager['getState']>;
    /**
     * 진행 상황 조회
     */
    getProgress(): ReturnType<WorkflowStateManager['getProgress']>;
}
