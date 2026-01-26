/**
 * AnalyzerAgent Unit Tests
 */

import { AnalyzerAgent } from '../src/agents/analyzer';
import { MockMCPAdapter, createSampleData } from './mocks/mcp-adapter.mock';

describe('AnalyzerAgent', () => {
  let agent: AnalyzerAgent;
  let mockMcp: MockMCPAdapter;
  const sampleData = createSampleData();

  const context = {
    sessionId: 'test-session',
    sourceWorkspace: { accountId: 'acc-1', containerId: 'con-1', workspaceId: 'ws-1' },
    targetWorkspace: { accountId: 'acc-2', containerId: 'con-2', workspaceId: 'ws-2' }
  };

  beforeEach(() => {
    agent = new AnalyzerAgent();
    mockMcp = new MockMCPAdapter(sampleData);
    agent.initialize(context, mockMcp as any);
  });

  describe('initialization', () => {
    it('should initialize with context and MCP adapter', () => {
      expect(agent.getRole()).toBe('analyzer');
      expect(agent.getStatus().initialized).toBe(true);
      expect(agent.getStatus().sessionId).toBe('test-session');
    });

    it('should throw when executing without initialization', async () => {
      const uninitializedAgent = new AnalyzerAgent();

      await expect(uninitializedAgent.execute({
        action: 'analyzeTags',
        data: { tagIds: ['tag-1'] },
        context
      })).rejects.toThrow('Agent not initialized');
    });
  });

  describe('analyzeTags action', () => {
    it('should analyze specified tags', async () => {
      const response = await agent.execute({
        action: 'analyzeTags',
        data: { tagIds: ['tag-1'] },
        context
      });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();

      const data = response.data as any;
      expect(data.analysisResult).toBeDefined();
      expect(data.sourceEntities).toBeDefined();
      expect(data.sourceEntities.tags.length).toBeGreaterThan(0);
    });

    it('should include dependencies when analyzing tags', async () => {
      const response = await agent.execute({
        action: 'analyzeTags',
        data: {
          tagIds: ['tag-1'],
          includeAllDependencies: true
        },
        context
      });

      expect(response.success).toBe(true);

      const data = response.data as any;
      expect(data.analysisResult.creationOrder).toBeDefined();
    });

    it('should fail when no tags found for given IDs', async () => {
      const response = await agent.execute({
        action: 'analyzeTags',
        data: { tagIds: ['non-existent-id'] },
        context
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('analyzeWorkspace action', () => {
    it('should analyze entire workspace', async () => {
      const response = await agent.execute({
        action: 'analyzeWorkspace',
        data: {},
        context
      });

      expect(response.success).toBe(true);

      const data = response.data as any;
      expect(data.analysisResult).toBeDefined();
      expect(data.sourceEntities.tags.length).toBe(2);
    });

    it('should apply tag filters', async () => {
      const response = await agent.execute({
        action: 'analyzeWorkspace',
        data: {
          tagFilter: {
            namePattern: 'Homepage'
          }
        },
        context
      });

      expect(response.success).toBe(true);

      const data = response.data as any;
      expect(data.sourceEntities.tags.length).toBe(1);
      expect(data.sourceEntities.tags[0].name).toContain('Homepage');
    });

    it('should apply limit filter', async () => {
      const response = await agent.execute({
        action: 'analyzeWorkspace',
        data: {
          tagFilter: {
            limit: 1
          }
        },
        context
      });

      expect(response.success).toBe(true);

      const data = response.data as any;
      expect(data.sourceEntities.tags.length).toBe(1);
    });
  });

  describe('listEntities action', () => {
    it('should list all entities', async () => {
      const response = await agent.execute({
        action: 'listEntities',
        data: {},
        context
      });

      expect(response.success).toBe(true);

      const data = response.data as any;
      expect(data.tags).toBeDefined();
      expect(data.triggers).toBeDefined();
      expect(data.variables).toBeDefined();
      expect(data.tags.length).toBe(2);
      expect(data.triggers.length).toBe(2);
      expect(data.variables.length).toBe(1);
    });
  });

  describe('unknown action', () => {
    it('should throw error for unknown action', async () => {
      await expect(agent.execute({
        action: 'unknownAction',
        data: {},
        context
      })).rejects.toThrow('Unknown action');
    });
  });

  describe('event handling', () => {
    it('should emit events during execution', async () => {
      const events: any[] = [];
      agent.onEvent((event) => events.push(event));

      await agent.execute({
        action: 'listEntities',
        data: {},
        context
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);
    });

    it('should emit failed event on error', async () => {
      const events: any[] = [];
      agent.onEvent((event) => events.push(event));

      await agent.execute({
        action: 'analyzeTags',
        data: { tagIds: ['non-existent'] },
        context
      });

      expect(events.some(e => e.type === 'failed')).toBe(true);
    });
  });
});
