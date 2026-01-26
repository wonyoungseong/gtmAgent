/**
 * Error Utilities Unit Tests
 */

import {
  AgentException,
  MCPConnectionError,
  MCPApiError,
  NotFoundError,
  AnalysisError,
  CircularDependencyError,
  CreationError,
  DuplicateNameError,
  ValidationError,
  WorkflowAbortedError,
  InvalidInputError,
  toAgentError,
  isAgentException,
  isRecoverable
} from '../src/utils/error';
import { AgentErrorCode } from '../src/types/agent';

describe('Error Classes', () => {
  describe('AgentException', () => {
    it('should create exception with code and message', () => {
      const error = new AgentException(AgentErrorCode.UNKNOWN_ERROR, 'Test error');

      expect(error.code).toBe(AgentErrorCode.UNKNOWN_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.recoverable).toBe(false);
    });

    it('should support recoverable option', () => {
      const error = new AgentException(AgentErrorCode.UNKNOWN_ERROR, 'Test', {
        recoverable: true
      });

      expect(error.recoverable).toBe(true);
    });

    it('should convert to AgentError interface', () => {
      const error = new AgentException(AgentErrorCode.INVALID_INPUT, 'Bad input', {
        details: { field: 'name' },
        recoverable: true,
        agentRole: 'analyzer'
      });

      const agentError = error.toAgentError();

      expect(agentError.code).toBe(AgentErrorCode.INVALID_INPUT);
      expect(agentError.message).toBe('Bad input');
      expect(agentError.details).toEqual({ field: 'name' });
      expect(agentError.recoverable).toBe(true);
      expect(agentError.agentRole).toBe('analyzer');
    });

    it('should serialize to JSON', () => {
      const error = new AgentException(AgentErrorCode.TIMEOUT, 'Timeout', {
        details: { duration: 5000 }
      });

      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'AgentException');
      expect(json).toHaveProperty('code', AgentErrorCode.TIMEOUT);
      expect(json).toHaveProperty('message', 'Timeout');
    });
  });

  describe('MCPConnectionError', () => {
    it('should be recoverable', () => {
      const error = new MCPConnectionError('Connection failed');

      expect(error.code).toBe(AgentErrorCode.MCP_CONNECTION_ERROR);
      expect(error.recoverable).toBe(true);
      expect(error.name).toBe('MCPConnectionError');
    });
  });

  describe('MCPApiError', () => {
    it('should not be recoverable', () => {
      const error = new MCPApiError('API error', { statusCode: 500 });

      expect(error.code).toBe(AgentErrorCode.MCP_API_ERROR);
      expect(error.recoverable).toBe(false);
      expect(error.details).toEqual({ statusCode: 500 });
    });
  });

  describe('NotFoundError', () => {
    it('should format message with entity type and identifier', () => {
      const error = new NotFoundError('Tag', 'tag-123');

      expect(error.message).toBe('Tag not found: tag-123');
      expect(error.code).toBe(AgentErrorCode.MCP_NOT_FOUND);
    });
  });

  describe('AnalysisError', () => {
    it('should have analyzer agent role', () => {
      const error = new AnalysisError('Analysis failed');

      expect(error.agentRole).toBe('analyzer');
      expect(error.code).toBe(AgentErrorCode.ANALYSIS_FAILED);
    });
  });

  describe('CircularDependencyError', () => {
    it('should format cycle in message', () => {
      const error = new CircularDependencyError(['A', 'B', 'C', 'A']);

      expect(error.message).toContain('A -> B -> C -> A');
      expect(error.code).toBe(AgentErrorCode.CIRCULAR_DEPENDENCY);
    });
  });

  describe('CreationError', () => {
    it('should be recoverable and have builder role', () => {
      const error = new CreationError('Tag', 'My Tag', 'Duplicate name');

      expect(error.recoverable).toBe(true);
      expect(error.agentRole).toBe('builder');
      expect(error.message).toContain('My Tag');
      expect(error.message).toContain('Duplicate name');
    });
  });

  describe('DuplicateNameError', () => {
    it('should format message with entity type and name', () => {
      const error = new DuplicateNameError('Variable', 'DLV - User ID');

      expect(error.message).toContain('Variable');
      expect(error.message).toContain('DLV - User ID');
      expect(error.message).toContain('already exists');
    });
  });

  describe('ValidationError', () => {
    it('should include issues in details', () => {
      const issues = [{ field: 'name', error: 'required' }];
      const error = new ValidationError('Validation failed', issues);

      expect(error.details).toEqual({ issues });
      expect(error.agentRole).toBe('validator');
    });
  });

  describe('WorkflowAbortedError', () => {
    it('should include phase in details', () => {
      const error = new WorkflowAbortedError('User cancelled', 'building');

      expect(error.details).toEqual({ phase: 'building' });
      expect(error.agentRole).toBe('orchestrator');
    });
  });

  describe('InvalidInputError', () => {
    it('should be recoverable', () => {
      const error = new InvalidInputError('Invalid tag ID', 'tagId');

      expect(error.recoverable).toBe(true);
      expect(error.details).toEqual({ field: 'tagId' });
    });
  });
});

describe('Utility Functions', () => {
  describe('toAgentError', () => {
    it('should convert AgentException to AgentError', () => {
      const exception = new MCPConnectionError('Connection failed');
      const error = toAgentError(exception);

      expect(error.code).toBe(AgentErrorCode.MCP_CONNECTION_ERROR);
      expect(error.message).toBe('Connection failed');
    });

    it('should convert standard Error to AgentError', () => {
      const stdError = new Error('Standard error');
      const error = toAgentError(stdError, 'analyzer');

      expect(error.code).toBe(AgentErrorCode.UNKNOWN_ERROR);
      expect(error.message).toBe('Standard error');
      expect(error.agentRole).toBe('analyzer');
    });

    it('should convert string to AgentError', () => {
      const error = toAgentError('String error');

      expect(error.code).toBe(AgentErrorCode.UNKNOWN_ERROR);
      expect(error.message).toBe('String error');
    });

    it('should convert unknown types to AgentError', () => {
      const error = toAgentError(42);

      expect(error.message).toBe('42');
    });
  });

  describe('isAgentException', () => {
    it('should return true for AgentException instances', () => {
      const exception = new MCPApiError('API Error');

      expect(isAgentException(exception)).toBe(true);
    });

    it('should return false for standard errors', () => {
      const error = new Error('Standard');

      expect(isAgentException(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isAgentException('string')).toBe(false);
      expect(isAgentException(null)).toBe(false);
      expect(isAgentException(undefined)).toBe(false);
    });
  });

  describe('isRecoverable', () => {
    it('should return true for recoverable exceptions', () => {
      const recoverable = new MCPConnectionError('Connection failed');

      expect(isRecoverable(recoverable)).toBe(true);
    });

    it('should return false for non-recoverable exceptions', () => {
      const nonRecoverable = new MCPApiError('API Error');

      expect(isRecoverable(nonRecoverable)).toBe(false);
    });

    it('should return false for non-AgentException errors', () => {
      expect(isRecoverable(new Error('Standard'))).toBe(false);
      expect(isRecoverable('string')).toBe(false);
    });
  });
});
