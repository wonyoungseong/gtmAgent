/**
 * ValidationChecker Unit Tests
 */

import { ValidationChecker, formatValidationReport, GTMTag, GTMTrigger, GTMVariable, IdMapping, EntityType } from '../src';

describe('ValidationChecker', () => {
  let checker: ValidationChecker;

  beforeEach(() => {
    checker = new ValidationChecker();
  });

  const createMockTag = (id: string, name: string, triggerIds: string[] = []): GTMTag => ({
    tagId: id,
    name,
    type: 'gaawe',
    firingTriggerId: triggerIds,
    parameter: [],
    fingerprint: 'fp',
    accountId: 'acc',
    containerId: 'con',
    workspaceId: 'ws'
  });

  const createMockTrigger = (id: string, name: string): GTMTrigger => ({
    triggerId: id,
    name,
    type: 'customEvent',
    fingerprint: 'fp',
    accountId: 'acc',
    containerId: 'con',
    workspaceId: 'ws'
  });

  const createMockVariable = (id: string, name: string): GTMVariable => ({
    variableId: id,
    name,
    type: 'v',
    parameter: [],
    fingerprint: 'fp',
    accountId: 'acc',
    containerId: 'con',
    workspaceId: 'ws'
  });

  describe('validate', () => {
    it('should pass validation when all entities are correctly replicated', () => {
      const sourceEntities = {
        tags: [createMockTag('src-tag-1', 'Tag 1', ['src-trigger-1'])],
        triggers: [createMockTrigger('src-trigger-1', 'Trigger 1')],
        variables: [createMockVariable('src-var-1', 'Variable 1')]
      };

      const targetEntities = {
        tags: [createMockTag('tgt-tag-1', 'Tag 1', ['tgt-trigger-1'])],
        triggers: [createMockTrigger('tgt-trigger-1', 'Trigger 1')],
        variables: [createMockVariable('tgt-var-1', 'Variable 1')]
      };

      const idMapping: IdMapping = {
        'src-tag-1': { newId: 'tgt-tag-1', type: EntityType.TAG, name: 'Tag 1' },
        'src-trigger-1': { newId: 'tgt-trigger-1', type: EntityType.TRIGGER, name: 'Trigger 1' },
        'src-var-1': { newId: 'tgt-var-1', type: EntityType.VARIABLE, name: 'Variable 1' }
      };

      const report = checker.validate({
        sourceEntities,
        targetEntities,
        idMapping,
        targetWorkspace: { containerId: 'con', workspaceId: 'ws' }
      });

      expect(report.success).toBe(true);
      expect(report.missing.length).toBe(0);
      expect(report.brokenReferences.length).toBe(0);
    });

    it('should detect missing entities', () => {
      const sourceEntities = {
        tags: [createMockTag('src-tag-1', 'Tag 1')],
        triggers: [],
        variables: []
      };

      const targetEntities = {
        tags: [],  // Tag is missing in target
        triggers: [],
        variables: []
      };

      const idMapping: IdMapping = {
        'src-tag-1': { newId: 'tgt-tag-1', type: EntityType.TAG, name: 'Tag 1' }  // Mapped but doesn't exist
      };

      const report = checker.validate({
        sourceEntities,
        targetEntities,
        idMapping,
        targetWorkspace: { containerId: 'con', workspaceId: 'ws' }
      });

      expect(report.success).toBe(false);
      expect(report.missing.length).toBeGreaterThan(0);
    });

    it('should detect broken references', () => {
      const sourceEntities = {
        tags: [createMockTag('src-tag-1', 'Tag 1', ['src-trigger-1'])],
        triggers: [createMockTrigger('src-trigger-1', 'Trigger 1')],
        variables: []
      };

      // Tag references a trigger that doesn't exist
      const targetEntities = {
        tags: [createMockTag('tgt-tag-1', 'Tag 1', ['non-existent-trigger'])],
        triggers: [],  // Trigger is missing
        variables: []
      };

      const idMapping: IdMapping = {
        'src-tag-1': { newId: 'tgt-tag-1', type: EntityType.TAG, name: 'Tag 1' },
        'src-trigger-1': { newId: 'tgt-trigger-1', type: EntityType.TRIGGER, name: 'Trigger 1' }
      };

      const report = checker.validate({
        sourceEntities,
        targetEntities,
        idMapping,
        targetWorkspace: { containerId: 'con', workspaceId: 'ws' }
      });

      expect(report.brokenReferences.length).toBeGreaterThan(0);
    });

    it('should include timestamp in report', () => {
      const report = checker.validate({
        sourceEntities: { tags: [], triggers: [], variables: [] },
        targetEntities: { tags: [], triggers: [], variables: [] },
        idMapping: {},
        targetWorkspace: { containerId: 'con', workspaceId: 'ws' }
      });

      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('preValidate', () => {
    it('should detect name conflicts', () => {
      const entitiesToCreate = {
        tags: [{ name: 'Existing Tag', type: 'html' }],
        triggers: [],
        variables: []
      };

      const existingEntities = {
        tags: [createMockTag('existing-1', 'Existing Tag')],
        triggers: [],
        variables: []
      };

      const result = checker.preValidate(entitiesToCreate as any, existingEntities);

      expect(result.canCreate).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].name).toBe('Existing Tag');
    });

    it('should pass when no conflicts exist', () => {
      const entitiesToCreate = {
        tags: [{ name: 'New Tag', type: 'html' }],
        triggers: [],
        variables: []
      };

      const existingEntities = {
        tags: [createMockTag('existing-1', 'Different Tag')],
        triggers: [],
        variables: []
      };

      const result = checker.preValidate(entitiesToCreate as any, existingEntities);

      expect(result.canCreate).toBe(true);
      expect(result.conflicts.length).toBe(0);
    });

    it('should detect conflicts for triggers and variables', () => {
      const entitiesToCreate = {
        tags: [],
        triggers: [{ name: 'Existing Trigger', type: 'customEvent' }],
        variables: [{ name: 'Existing Variable', type: 'v' }]
      };

      const existingEntities = {
        tags: [],
        triggers: [createMockTrigger('t-1', 'Existing Trigger')],
        variables: [createMockVariable('v-1', 'Existing Variable')]
      };

      const result = checker.preValidate(entitiesToCreate as any, existingEntities);

      expect(result.canCreate).toBe(false);
      expect(result.conflicts.length).toBe(2);
    });
  });

  describe('checkIntegrity', () => {
    it('should pass for valid entity references', () => {
      const entities = {
        tags: [createMockTag('tag-1', 'Tag', ['trigger-1'])],
        triggers: [createMockTrigger('trigger-1', 'Trigger')],
        variables: []
      };

      const result = checker.checkIntegrity(entities);

      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should detect tags with missing triggers', () => {
      const entities = {
        tags: [createMockTag('tag-1', 'Tag', ['non-existent-trigger'])],
        triggers: [],  // Trigger doesn't exist
        variables: []
      };

      const result = checker.checkIntegrity(entities);

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].issueType).toBe('missing_trigger');
    });

    it('should detect missing variable references in tags', () => {
      const tagWithVarRef = createMockTag('tag-1', 'Tag');
      tagWithVarRef.parameter = [
        { type: 'TEMPLATE', key: 'value', value: '{{Missing Variable}}' }
      ];

      const entities = {
        tags: [tagWithVarRef],
        triggers: [],
        variables: []  // Variable doesn't exist
      };

      const result = checker.checkIntegrity(entities);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.issueType === 'missing_variable')).toBe(true);
    });
  });

  describe('formatValidationReport', () => {
    it('should format report as readable string', () => {
      const report = {
        success: false,
        timestamp: new Date().toISOString(),
        source: { containerId: 'src', workspaceId: 'ws1', entityCount: 5 },
        target: { containerId: 'tgt', workspaceId: 'ws2', entityCount: 4 },
        summary: { expectedCount: 5, actualCount: 4, missingCount: 1, brokenRefCount: 0 },
        missing: [{ type: EntityType.TAG, originalId: 'tag-1', name: 'Missing Tag', reason: 'Not found' }],
        brokenReferences: [],
        warnings: ['Some warning']
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('Missing Tag');
      expect(formatted).toContain('FAILED');
      expect(formatted).toContain('Missing:');
    });

    it('should show success message for passed validation', () => {
      const report = {
        success: true,
        timestamp: new Date().toISOString(),
        source: { containerId: 'src', workspaceId: 'ws1', entityCount: 5 },
        target: { containerId: 'tgt', workspaceId: 'ws2', entityCount: 5 },
        summary: { expectedCount: 5, actualCount: 5, missingCount: 0, brokenRefCount: 0 },
        missing: [],
        brokenReferences: [],
        warnings: []
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('PASSED');
    });

    it('should include warnings in formatted output', () => {
      const report = {
        success: true,
        timestamp: new Date().toISOString(),
        source: { containerId: 'src', workspaceId: 'ws1', entityCount: 5 },
        target: { containerId: 'tgt', workspaceId: 'ws2', entityCount: 5 },
        summary: { expectedCount: 5, actualCount: 5, missingCount: 0, brokenRefCount: 0 },
        missing: [],
        brokenReferences: [],
        warnings: ['Warning message 1', 'Warning message 2']
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('Warning message 1');
      expect(formatted).toContain('Warning message 2');
    });
  });
});
