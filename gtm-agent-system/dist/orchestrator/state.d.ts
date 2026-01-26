/**
 * Workflow State Management
 * 워크플로우 상태 관리 및 리듀서
 */
import { WorkflowState, WorkflowAction, WorkflowPhase, WorkflowProgress } from '../types/workflow';
import { AgentError, WorkspaceContext } from '../types/agent';
export declare function createInitialState(sessionId: string): WorkflowState;
export declare function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState;
export declare class WorkflowStateManager {
    private state;
    private listeners;
    constructor(sessionId: string);
    /**
     * 현재 상태 반환
     */
    getState(): WorkflowState;
    /**
     * 액션 디스패치
     */
    dispatch(action: WorkflowAction): void;
    /**
     * 상태 변경 구독
     */
    subscribe(listener: (state: WorkflowState) => void): () => void;
    /**
     * 리스너 알림
     */
    private notifyListeners;
    /**
     * 워크플로우 시작
     */
    start(source: WorkspaceContext, target: WorkspaceContext): void;
    /**
     * 페이즈 전환
     */
    transitionTo(phase: WorkflowPhase): void;
    /**
     * 에러 추가
     */
    addError(error: AgentError): void;
    /**
     * 경고 추가
     */
    addWarning(warning: string): void;
    /**
     * 워크플로우 완료
     */
    complete(): void;
    /**
     * 상태 리셋
     */
    reset(): void;
    /**
     * 진행 상황 계산
     */
    getProgress(): WorkflowProgress;
    /**
     * 상태 스냅샷 생성
     */
    createSnapshot(): WorkflowState;
    /**
     * 스냅샷에서 복원
     */
    restoreFromSnapshot(snapshot: WorkflowState): void;
}
export declare function getStateManager(sessionId: string): WorkflowStateManager;
export declare function removeStateManager(sessionId: string): void;
export declare function clearAllStateManagers(): void;
