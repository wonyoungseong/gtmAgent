/**
 * IdMapper Unit Tests
 */

import { IdMapper, EntityType } from '../src';

describe('IdMapper', () => {
  let mapper: IdMapper;

  beforeEach(() => {
    mapper = new IdMapper();
  });

  describe('add and getNewId', () => {
    it('should add and retrieve ID mapping', () => {
      mapper.add('source-1', 'target-1', EntityType.TAG, 'Test Tag');

      expect(mapper.getNewId('source-1')).toBe('target-1');
    });

    it('should return undefined for non-existent mapping', () => {
      expect(mapper.getNewId('non-existent')).toBeUndefined();
    });

    it('should handle multiple mappings', () => {
      mapper.add('tag-1', 'new-tag-1', EntityType.TAG, 'Tag 1');
      mapper.add('trigger-1', 'new-trigger-1', EntityType.TRIGGER, 'Trigger 1');
      mapper.add('var-1', 'new-var-1', EntityType.VARIABLE, 'Variable 1');

      expect(mapper.getNewId('tag-1')).toBe('new-tag-1');
      expect(mapper.getNewId('trigger-1')).toBe('new-trigger-1');
      expect(mapper.getNewId('var-1')).toBe('new-var-1');
    });
  });

  describe('getNewIdByName', () => {
    it('should retrieve ID by entity name', () => {
      mapper.add('source-1', 'target-1', EntityType.TAG, 'Test Tag');

      expect(mapper.getNewIdByName('Test Tag')).toBe('target-1');
    });
  });

  describe('getOriginalId', () => {
    it('should get original ID from new ID', () => {
      mapper.add('source-1', 'target-1', EntityType.TAG, 'Test Tag');

      expect(mapper.getOriginalId('target-1')).toBe('source-1');
    });
  });

  describe('filterByType', () => {
    it('should filter mappings by entity type', () => {
      mapper.add('tag-1', 'new-tag-1', EntityType.TAG, 'Tag 1');
      mapper.add('tag-2', 'new-tag-2', EntityType.TAG, 'Tag 2');
      mapper.add('trigger-1', 'new-trigger-1', EntityType.TRIGGER, 'Trigger 1');

      const tagMappings = mapper.filterByType(EntityType.TAG);

      expect(Object.keys(tagMappings).length).toBe(2);
      expect(tagMappings['tag-1'].newId).toBe('new-tag-1');
      expect(tagMappings['tag-2'].newId).toBe('new-tag-2');
    });
  });

  describe('has', () => {
    it('should return true for existing mapping', () => {
      mapper.add('source-1', 'target-1', EntityType.TAG, 'Test');

      expect(mapper.has('source-1')).toBe(true);
    });

    it('should return false for non-existent mapping', () => {
      expect(mapper.has('non-existent')).toBe(false);
    });

    it('should support name: prefix lookup', () => {
      mapper.add('source-1', 'target-1', EntityType.TAG, 'Test Tag');

      expect(mapper.has('name:Test Tag')).toBe(true);
      expect(mapper.has('name:Non Existent')).toBe(false);
    });
  });

  describe('hasByName', () => {
    it('should check by entity name', () => {
      mapper.add('source-1', 'target-1', EntityType.TAG, 'Test Tag');

      expect(mapper.hasByName('Test Tag')).toBe(true);
      expect(mapper.hasByName('Non Existent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all mappings as IdMapping object', () => {
      mapper.add('tag-1', 'new-tag-1', EntityType.TAG, 'Tag 1');
      mapper.add('trigger-1', 'new-trigger-1', EntityType.TRIGGER, 'Trigger 1');

      const all = mapper.getAll();

      expect(all['tag-1'].newId).toBe('new-tag-1');
      expect(all['tag-1'].type).toBe(EntityType.TAG);
      expect(all['trigger-1'].newId).toBe('new-trigger-1');
    });
  });

  describe('clear', () => {
    it('should remove all mappings', () => {
      mapper.add('tag-1', 'new-tag-1', EntityType.TAG, 'Tag 1');
      mapper.add('trigger-1', 'new-trigger-1', EntityType.TRIGGER, 'Trigger 1');

      mapper.clear();

      expect(mapper.has('tag-1')).toBe(false);
      expect(mapper.has('trigger-1')).toBe(false);
      expect(mapper.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should return correct count of mappings', () => {
      expect(mapper.size).toBe(0);

      mapper.add('tag-1', 'new-tag-1', EntityType.TAG, 'Tag 1');
      expect(mapper.size).toBe(1);

      mapper.add('trigger-1', 'new-trigger-1', EntityType.TRIGGER, 'Trigger 1');
      expect(mapper.size).toBe(2);
    });
  });

  describe('transformIdReferences', () => {
    it('should transform IDs in text', () => {
      mapper.add('old-id-123', 'new-id-456', EntityType.TAG, 'Tag');

      const text = 'Reference to old-id-123 and another old-id-123';
      const result = mapper.transformIdReferences(text);

      expect(result).toBe('Reference to new-id-456 and another new-id-456');
    });
  });

  describe('transformIdArray', () => {
    it('should transform array of IDs', () => {
      mapper.add('id-1', 'new-1', EntityType.TAG, 'Tag 1');
      mapper.add('id-2', 'new-2', EntityType.TAG, 'Tag 2');

      const result = mapper.transformIdArray(['id-1', 'id-2', 'id-3']);

      expect(result).toEqual(['new-1', 'new-2', 'id-3']);
    });
  });

  describe('transformObject', () => {
    it('should transform ID fields in object', () => {
      mapper.add('old-trigger-1', 'new-trigger-1', EntityType.TRIGGER, 'Trigger');

      const obj = {
        name: 'Test',
        firingTriggerId: ['old-trigger-1', 'other-id']
      };

      const result = mapper.transformObject(obj, ['firingTriggerId']);

      expect(result.firingTriggerId).toEqual(['new-trigger-1', 'other-id']);
    });
  });

  describe('templateTypeMapping', () => {
    it('should add and retrieve template type mapping', () => {
      mapper.addTemplateTypeMapping('cvt_172990757_195', 'cvt_210926331_42');

      expect(mapper.getNewTemplateType('cvt_172990757_195')).toBe('cvt_210926331_42');
    });

    it('should return undefined for non-existent template type mapping', () => {
      expect(mapper.getNewTemplateType('cvt_unknown')).toBeUndefined();
    });

    it('should handle multiple template type mappings', () => {
      mapper.addTemplateTypeMapping('cvt_111_1', 'cvt_222_10');
      mapper.addTemplateTypeMapping('cvt_111_2', 'cvt_222_20');

      expect(mapper.getNewTemplateType('cvt_111_1')).toBe('cvt_222_10');
      expect(mapper.getNewTemplateType('cvt_111_2')).toBe('cvt_222_20');
    });

    it('should be cleared by clear()', () => {
      mapper.addTemplateTypeMapping('cvt_111_1', 'cvt_222_10');
      mapper.clear();

      expect(mapper.getNewTemplateType('cvt_111_1')).toBeUndefined();
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON and restore', () => {
      mapper.add('tag-1', 'new-tag-1', EntityType.TAG, 'Tag 1');
      mapper.add('var-1', 'new-var-1', EntityType.VARIABLE, 'Variable 1');

      const json = mapper.toJSON();
      const restored = IdMapper.fromJSON(json);

      expect(restored.getNewId('tag-1')).toBe('new-tag-1');
      expect(restored.getNewId('var-1')).toBe('new-var-1');
    });
  });
});
