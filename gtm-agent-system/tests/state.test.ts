/**
 * Workflow State Management Unit Tests
 */

import {
  WorkflowStateManager,
  createInitialState,
  workflowReducer,
  getStateManager,
  removeStateManager,
  clearAllStateManagers
} from '../src/orchestrator/state';
import { WorkflowState, WorkflowAction } from '../src/types/workflow';
import { AgentErrorCode } from '../src/types/agent';
import { EntityType, GTMTag, GTMTrigger, GTMVariable, AnalysisResult, CreatedEntity } from 'gtm-agent-skills';

describe('createInitialState', () => {
  it('should create initial state with session ID', () => {
    const state = createInitialState('test-session');

    expect(state.sessionId).toBe('test-session');
    expect(state.phase).toBe('idle');
    expect(state.createdEntities).toEqual([]);
    expect(state.errors).toEqual([]);
    expect(state.warnings).toEqual([]);
  });
});

describe('workflowReducer', () => {
  let initialState: WorkflowState;

  beforeEach(() => {
    initialState = createInitialState('test-session');
  });

  describe('START action', () => {
    it('should set source and target workspaces and transition to analyzing', () => {
      const action: WorkflowAction = {
        type: 'START',
        payload: {
          source: { accountId: 'acc1', containerId: 'con1', workspaceId: 'ws1' },
          target: { accountId: 'acc2', containerId: 'con2', workspaceId: 'ws2' }
        }
      };

      const newState = workflowReducer(initialState, action);

      expect(newState.phase).toBe('analyzing');
      expect(newState.sourceWorkspace).toEqual(action.payload.source);
      expect(newState.targetWorkspace).toEqual(action.payload.target);
      expect(newState.startedAt).toBeDefined();
    });
  });

  describe('SET_ANALYSIS_RESULT action', () => {
    it('should set analysis result', () => {
      const mockResult: AnalysisResult = {
        nodes: {},
        creationOrder: [],
        summary: {
          total: 0,
          tags: 0,
          triggers: 0,
          variables: 0,
          templates: 0,
          jsVariablesWithInternalRefs: 0
        }
      };

      const action: WorkflowAction = {
        type: 'SET_ANALYSIS_RESULT',
        payload: mockResult
      };

      const newState = workflowReducer(initialState, action);

      expect(newState.analysisResult).toEqual(mockResult);
    });
  });

  describe('SET_SOURCE_ENTITIES action', () => {
    it('should set source entities', () => {
      const mockTag: GTMTag = {
        tagId: '1',
        name: 'Tag',
        type: 'html',
        accountId: 'acc1',
        containerId: 'con1',
        workspaceId: 'ws1',
        fingerprint: 'fp1'
      };
      const entities: { tags: GTMTag[]; triggers: GTMTrigger[]; variables: GTMVariable[] } = {
        tags: [mockTag],
        triggers: [],
        variables: []
      };

      const action: WorkflowAction = {
        type: 'SET_SOURCE_ENTITIES',
        payload: entities
      };

      const newState = workflowReducer(initialState, action);

      expect(newState.sourceEntities).toEqual(entities);
    });
  });

  describe('ADD_CREATED_ENTITY action', () => {
    it('should append created entity to list', () => {
      const entity: CreatedEntity = {
        type: EntityType.TAG,
        originalId: 'old-1',
        newId: 'new-1',
        name: 'Test Tag'
      };

      const action: WorkflowAction = {
        type: 'ADD_CREATED_ENTITY',
        payload: entity
      };

      const newState = workflowReducer(initialState, action);

      expect(newState.createdEntities).toHaveLength(1);
      expect(newState.createdEntities[0]).toEqual(entity);
    });

    it('should not mutate original state', () => {
      const entity: CreatedEntity = {
        type: EntityType.TAG,
        originalId: '1',
        newId: '2',
        name: 'T'
      };

      const action: WorkflowAction = {
        type: 'ADD_CREATED_ENTITY',
        payload: entity
      };

      workflowReducer(initialState, action);

      expect(initialState.createdEntities).toHaveLength(0);
    });
  });

  describe('ADD_ERROR action', () => {
    it('should append error to list', () => {
      const error = {
        code: AgentErrorCode.CREATION_FAILED,
        message: 'Failed',
        recoverable: false
      };

      const action: WorkflowAction = {
        type: 'ADD_ERROR',
        payload: error
      };

      const newState = workflowReducer(initialState, action);

      expect(newState.errors).toHaveLength(1);
      expect(newState.errors[0]).toEqual(error);
    });
  });

  describe('TRANSITION_PHASE action', () => {
    it('should change phase', () => {
      const action: WorkflowAction = {
        type: 'TRANSITION_PHASE',
        payload: 'building'
      };

      const newState = workflowReducer(initialState, action);

      expect(newState.phase).toBe('building');
    });
  });

  describe('COMPLETE action', () => {
    it('should set phase to completed and set completedAt', () => {
      const action: WorkflowAction = { type: 'COMPLETE' };

      const newState = workflowReducer(initialState, action);

      expect(newState.phase).toBe('completed');
      expect(newState.completedAt).toBeDefined();
    });
  });

  describe('RESET action', () => {
    it('should reset to initial state', () => {
      const modifiedState: WorkflowState = {
        ...initialState,
        phase: 'building',
        errors: [{ code: AgentErrorCode.UNKNOWN_ERROR, message: 'Error', recoverable: false }]
      };

      const action: WorkflowAction = { type: 'RESET' };

      const newState = workflowReducer(modifiedState, action);

      expect(newState.phase).toBe('idle');
      expect(newState.errors).toHaveLength(0);
      expect(newState.sessionId).toBe('test-session');
    });
  });
});

describe('WorkflowStateManager', () => {
  let manager: WorkflowStateManager;

  beforeEach(() => {
    manager = new WorkflowStateManager('test-session');
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = manager.getState();

      expect(state.sessionId).toBe('test-session');
      expect(state.phase).toBe('idle');
    });

    it('should return a copy of state (immutable)', () => {
      const state1 = manager.getState();
      const state2 = manager.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('dispatch', () => {
    it('should update state', () => {
      manager.dispatch({
        type: 'TRANSITION_PHASE',
        payload: 'analyzing'
      });

      expect(manager.getState().phase).toBe('analyzing');
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on state change', () => {
      const listener = jest.fn();
      manager.subscribe(listener);

      manager.dispatch({ type: 'TRANSITION_PHASE', payload: 'analyzing' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ phase: 'analyzing' }));
    });

    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = manager.subscribe(listener);

      manager.dispatch({ type: 'TRANSITION_PHASE', payload: 'analyzing' });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.dispatch({ type: 'TRANSITION_PHASE', payload: 'building' });
      expect(listener).toHaveBeenCalledTimes(1);  // Not called again
    });
  });

  describe('start', () => {
    it('should initialize workflow', () => {
      manager.start(
        { accountId: 'acc1', containerId: 'con1', workspaceId: 'ws1' },
        { accountId: 'acc2', containerId: 'con2', workspaceId: 'ws2' }
      );

      const state = manager.getState();
      expect(state.phase).toBe('analyzing');
      expect(state.sourceWorkspace.accountId).toBe('acc1');
      expect(state.targetWorkspace.accountId).toBe('acc2');
    });
  });

  describe('transitionTo', () => {
    it('should change phase', () => {
      manager.transitionTo('building');

      expect(manager.getState().phase).toBe('building');
    });
  });

  describe('addError', () => {
    it('should add error to state', () => {
      manager.addError({
        code: AgentErrorCode.CREATION_FAILED,
        message: 'Failed',
        recoverable: false
      });

      expect(manager.getState().errors).toHaveLength(1);
    });

    it('should transition to error phase for non-recoverable errors', () => {
      manager.addError({
        code: AgentErrorCode.CREATION_FAILED,
        message: 'Fatal',
        recoverable: false
      });

      expect(manager.getState().phase).toBe('error');
    });

    it('should not transition for recoverable errors', () => {
      manager.transitionTo('building');
      manager.addError({
        code: AgentErrorCode.DUPLICATE_NAME,
        message: 'Duplicate',
        recoverable: true
      });

      expect(manager.getState().phase).toBe('building');
    });
  });

  describe('addWarning', () => {
    it('should add warning to state', () => {
      manager.addWarning('This is a warning');

      expect(manager.getState().warnings).toContain('This is a warning');
    });
  });

  describe('complete', () => {
    it('should mark workflow as completed', () => {
      manager.complete();

      expect(manager.getState().phase).toBe('completed');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      manager.transitionTo('building');
      manager.addError({ code: AgentErrorCode.UNKNOWN_ERROR, message: 'E', recoverable: false });

      manager.reset();

      expect(manager.getState().phase).toBe('idle');
      expect(manager.getState().errors).toHaveLength(0);
    });
  });

  describe('getProgress', () => {
    it('should return progress for each phase', () => {
      expect(manager.getProgress().phase).toBe('idle');
      expect(manager.getProgress().percentage).toBe(0);

      manager.transitionTo('analyzing');
      expect(manager.getProgress().currentStep).toBe(1);

      manager.transitionTo('validating');
      expect(manager.getProgress().currentStep).toBe(5);
      expect(manager.getProgress().percentage).toBe(100);
    });
  });

  describe('createSnapshot and restoreFromSnapshot', () => {
    it('should create and restore snapshot', () => {
      manager.transitionTo('building');
      manager.addWarning('Test warning');

      const snapshot = manager.createSnapshot();

      manager.reset();
      expect(manager.getState().phase).toBe('idle');

      manager.restoreFromSnapshot(snapshot);
      expect(manager.getState().phase).toBe('building');
      expect(manager.getState().warnings).toContain('Test warning');
    });
  });
});

describe('Factory Functions', () => {
  afterEach(() => {
    clearAllStateManagers();
  });

  describe('getStateManager', () => {
    it('should create new manager for new session ID', () => {
      const manager = getStateManager('session-1');

      expect(manager).toBeInstanceOf(WorkflowStateManager);
      expect(manager.getState().sessionId).toBe('session-1');
    });

    it('should return same manager for same session ID', () => {
      const manager1 = getStateManager('session-1');
      const manager2 = getStateManager('session-1');

      expect(manager1).toBe(manager2);
    });

    it('should return different managers for different session IDs', () => {
      const manager1 = getStateManager('session-1');
      const manager2 = getStateManager('session-2');

      expect(manager1).not.toBe(manager2);
    });
  });

  describe('removeStateManager', () => {
    it('should remove manager for session ID', () => {
      const manager1 = getStateManager('session-1');
      manager1.transitionTo('building');

      removeStateManager('session-1');

      const manager2 = getStateManager('session-1');
      expect(manager2.getState().phase).toBe('idle');  // Fresh manager
    });
  });

  describe('clearAllStateManagers', () => {
    it('should remove all managers', () => {
      const m1 = getStateManager('session-1');
      const m2 = getStateManager('session-2');
      m1.transitionTo('building');
      m2.transitionTo('analyzing');

      clearAllStateManagers();

      expect(getStateManager('session-1').getState().phase).toBe('idle');
      expect(getStateManager('session-2').getState().phase).toBe('idle');
    });
  });
});
