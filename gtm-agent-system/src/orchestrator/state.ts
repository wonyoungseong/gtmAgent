/**
 * Workflow State Management
 * 워크플로우 상태 관리 및 리듀서
 */

import {
  WorkflowState,
  WorkflowAction,
  WorkflowPhase,
  WorkflowProgress,
  TargetEntities
} from '../types/workflow';
import { AgentError, WorkspaceContext } from '../types/agent';

// ==================== Initial State ====================

export function createInitialState(sessionId: string): WorkflowState {
  return {
    sessionId,
    phase: 'idle',
    sourceWorkspace: { accountId: '', containerId: '', workspaceId: '' },
    targetWorkspace: { accountId: '', containerId: '', workspaceId: '' },
    createdEntities: [],
    errors: [],
    warnings: []
  };
}

// ==================== State Reducer ====================

export function workflowReducer(
  state: WorkflowState,
  action: WorkflowAction
): WorkflowState {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        phase: 'analyzing',
        sourceWorkspace: action.payload.source,
        targetWorkspace: action.payload.target,
        startedAt: new Date().toISOString(),
        errors: [],
        warnings: []
      };

    case 'SET_ANALYSIS_RESULT':
      return {
        ...state,
        analysisResult: action.payload
      };

    case 'SET_SOURCE_ENTITIES':
      return {
        ...state,
        sourceEntities: action.payload
      };

    case 'SET_TARGET_ENTITIES':
      return {
        ...state,
        targetEntities: action.payload
      };

    case 'SET_NAMING_PATTERN':
      return {
        ...state,
        namingPattern: action.payload
      };

    case 'SET_ENTITY_NAME_MAP':
      return {
        ...state,
        entityNameMap: action.payload
      };

    case 'SET_CREATION_PLAN':
      return {
        ...state,
        creationPlan: action.payload
      };

    case 'ADD_CREATED_ENTITY':
      return {
        ...state,
        createdEntities: [...state.createdEntities, action.payload]
      };

    case 'SET_ID_MAPPING':
      return {
        ...state,
        idMapping: action.payload
      };

    case 'SET_VALIDATION_REPORT':
      return {
        ...state,
        validationReport: action.payload
      };

    case 'ADD_ERROR':
      return {
        ...state,
        errors: [...state.errors, action.payload]
      };

    case 'ADD_WARNING':
      return {
        ...state,
        warnings: [...state.warnings, action.payload]
      };

    case 'TRANSITION_PHASE':
      return {
        ...state,
        phase: action.payload
      };

    case 'COMPLETE':
      return {
        ...state,
        phase: 'completed',
        completedAt: new Date().toISOString()
      };

    case 'RESET':
      return createInitialState(state.sessionId);

    default:
      return state;
  }
}

// ==================== State Manager Class ====================

export class WorkflowStateManager {
  private state: WorkflowState;
  private listeners: Array<(state: WorkflowState) => void> = [];

  constructor(sessionId: string) {
    this.state = createInitialState(sessionId);
  }

  /**
   * 현재 상태 반환
   */
  getState(): WorkflowState {
    return { ...this.state };
  }

  /**
   * 액션 디스패치
   */
  dispatch(action: WorkflowAction): void {
    this.state = workflowReducer(this.state, action);
    this.notifyListeners();
  }

  /**
   * 상태 변경 구독
   */
  subscribe(listener: (state: WorkflowState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 리스너 알림
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  /**
   * 워크플로우 시작
   */
  start(source: WorkspaceContext, target: WorkspaceContext): void {
    this.dispatch({ type: 'START', payload: { source, target } });
  }

  /**
   * 페이즈 전환
   */
  transitionTo(phase: WorkflowPhase): void {
    this.dispatch({ type: 'TRANSITION_PHASE', payload: phase });
  }

  /**
   * 에러 추가
   */
  addError(error: AgentError): void {
    this.dispatch({ type: 'ADD_ERROR', payload: error });
    if (!error.recoverable) {
      this.transitionTo('error');
    }
  }

  /**
   * 경고 추가
   */
  addWarning(warning: string): void {
    this.dispatch({ type: 'ADD_WARNING', payload: warning });
  }

  /**
   * 워크플로우 완료
   */
  complete(): void {
    this.dispatch({ type: 'COMPLETE' });
  }

  /**
   * 상태 리셋
   */
  reset(): void {
    this.dispatch({ type: 'RESET' });
  }

  /**
   * 진행 상황 계산
   */
  getProgress(): WorkflowProgress {
    const phaseSteps: Record<WorkflowPhase, { current: number; total: number; desc: string }> = {
      idle: { current: 0, total: 5, desc: 'Ready to start' },
      analyzing: { current: 1, total: 5, desc: 'Analyzing source workspace' },
      naming: { current: 2, total: 5, desc: 'Processing naming patterns' },
      planning: { current: 3, total: 5, desc: 'Creating execution plan' },
      building: { current: 4, total: 5, desc: 'Building entities in target' },
      validating: { current: 5, total: 5, desc: 'Validating results' },
      completed: { current: 5, total: 5, desc: 'Completed' },
      error: { current: -1, total: 5, desc: 'Error occurred' }
    };

    const step = phaseSteps[this.state.phase];
    return {
      phase: this.state.phase,
      currentStep: step.current,
      totalSteps: step.total,
      description: step.desc,
      percentage: step.current >= 0 ? Math.round((step.current / step.total) * 100) : 0
    };
  }

  /**
   * 상태 스냅샷 생성
   */
  createSnapshot(): WorkflowState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * 스냅샷에서 복원
   */
  restoreFromSnapshot(snapshot: WorkflowState): void {
    this.state = snapshot;
    this.notifyListeners();
  }
}

// ==================== Factory Functions ====================

const stateManagers = new Map<string, WorkflowStateManager>();

export function getStateManager(sessionId: string): WorkflowStateManager {
  if (!stateManagers.has(sessionId)) {
    stateManagers.set(sessionId, new WorkflowStateManager(sessionId));
  }
  return stateManagers.get(sessionId)!;
}

export function removeStateManager(sessionId: string): void {
  stateManagers.delete(sessionId);
}

export function clearAllStateManagers(): void {
  stateManagers.clear();
}
