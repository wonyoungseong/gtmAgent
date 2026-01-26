/**
 * ConfigTransformer Unit Tests
 */

import { ConfigTransformer, IdMapper, EntityType, GTMTag, GTMTrigger, GTMVariable, extractCreateConfig, compareConfigs } from '../src';

describe('ConfigTransformer', () => {
  let transformer: ConfigTransformer;
  let idMapper: IdMapper;

  beforeEach(() => {
    idMapper = new IdMapper();
    transformer = new ConfigTransformer(idMapper);
  });

  describe('transformVariable', () => {
    const sampleVariable: GTMVariable = {
      variableId: 'var-123',
      name: 'DLV - User ID',
      type: 'v',
      parameter: [
        { type: 'INTEGER', key: 'dataLayerVersion', value: '2' },
        { type: 'TEMPLATE', key: 'name', value: 'user_id' }
      ],
      fingerprint: 'abc123',
      accountId: 'acc-1',
      containerId: 'con-1',
      workspaceId: 'ws-1'
    };

    it('should transform variable for creation', () => {
      const result = transformer.transformVariable(sampleVariable);

      expect(result.name).toBe('DLV - User ID');
      expect(result.type).toBe('v');
      expect(result.parameter).toBeDefined();
      // Should not include IDs
      expect(result.variableId).toBeUndefined();
      expect(result.accountId).toBeUndefined();
      expect(result.containerId).toBeUndefined();
      expect(result.workspaceId).toBeUndefined();
      expect(result.fingerprint).toBeUndefined();
    });

    it('should apply new name when provided', () => {
      const result = transformer.transformVariable(sampleVariable, { newName: 'Custom Name' });

      expect(result.name).toBe('Custom Name');
    });

    it('should apply name prefix and suffix', () => {
      const result = transformer.transformVariable(sampleVariable, {
        namePrefix: '[COPY] ',
        nameSuffix: ' v2'
      });

      expect(result.name).toBe('[COPY] DLV - User ID v2');
    });
  });

  describe('transformTrigger', () => {
    const sampleTrigger: GTMTrigger = {
      triggerId: 'trigger-123',
      name: 'CE - Button Click',
      type: 'customEvent',
      customEventFilter: [
        {
          type: 'EQUALS',
          parameter: [
            { type: 'TEMPLATE', key: 'arg0', value: '{{_event}}' },
            { type: 'TEMPLATE', key: 'arg1', value: 'button_click' }
          ]
        }
      ],
      fingerprint: 'abc123',
      accountId: 'acc-1',
      containerId: 'con-1',
      workspaceId: 'ws-1'
    };

    it('should transform trigger for creation', () => {
      const result = transformer.transformTrigger(sampleTrigger);

      expect(result.name).toBe('CE - Button Click');
      expect(result.type).toBe('customEvent');
      expect(result.customEventFilter).toBeDefined();
      // Should not include IDs
      expect(result.triggerId).toBeUndefined();
      expect(result.fingerprint).toBeUndefined();
    });

    it('should apply new name when provided', () => {
      const result = transformer.transformTrigger(sampleTrigger, { newName: 'New Trigger Name' });

      expect(result.name).toBe('New Trigger Name');
    });

    it('should preserve notes when option is set', () => {
      const triggerWithNotes = { ...sampleTrigger, notes: 'Important trigger' };
      const result = transformer.transformTrigger(triggerWithNotes, { preserveNotes: true });

      expect(result.notes).toBe('Important trigger');
    });
  });

  describe('transformTag', () => {
    const sampleTag: GTMTag = {
      tagId: 'tag-123',
      name: 'GA4 - Homepage - Pageview',
      type: 'gaawe',
      firingTriggerId: ['trigger-old-1', 'trigger-old-2'],
      parameter: [
        { type: 'TEMPLATE', key: 'eventName', value: 'page_view' }
      ],
      fingerprint: 'abc123',
      accountId: 'acc-1',
      containerId: 'con-1',
      workspaceId: 'ws-1'
    };

    it('should transform tag for creation', () => {
      const result = transformer.transformTag(sampleTag);

      expect(result.name).toBe('GA4 - Homepage - Pageview');
      expect(result.type).toBe('gaawe');
      expect(result.parameter).toBeDefined();
      // Should not include IDs
      expect(result.tagId).toBeUndefined();
      expect(result.fingerprint).toBeUndefined();
    });

    it('should transform trigger IDs using idMapper', () => {
      // Add ID mappings
      idMapper.add('trigger-old-1', 'trigger-new-1', EntityType.TRIGGER, 'Trigger 1');
      idMapper.add('trigger-old-2', 'trigger-new-2', EntityType.TRIGGER, 'Trigger 2');

      const result = transformer.transformTag(sampleTag);

      expect(result.firingTriggerId).toContain('trigger-new-1');
      expect(result.firingTriggerId).toContain('trigger-new-2');
    });

    it('should keep original trigger ID if no mapping exists', () => {
      // Only map one trigger
      idMapper.add('trigger-old-1', 'trigger-new-1', EntityType.TRIGGER, 'Trigger 1');

      const result = transformer.transformTag(sampleTag);

      expect(result.firingTriggerId).toContain('trigger-new-1');
      expect(result.firingTriggerId).toContain('trigger-old-2'); // unchanged
    });

    it('should apply new name when provided', () => {
      const result = transformer.transformTag(sampleTag, { newName: 'New Tag Name' });

      expect(result.name).toBe('New Tag Name');
    });

    it('should transform blocking trigger IDs', () => {
      const tagWithBlocking: GTMTag = {
        ...sampleTag,
        blockingTriggerId: ['block-old-1']
      };
      idMapper.add('block-old-1', 'block-new-1', EntityType.TRIGGER, 'Blocking');

      const result = transformer.transformTag(tagWithBlocking);

      expect(result.blockingTriggerId).toContain('block-new-1');
    });

    it('should transform setup and teardown tag IDs to tagName', () => {
      // GTM API requires tagName instead of tagId for setup/teardown tags
      const tagWithSequencing: GTMTag = {
        ...sampleTag,
        setupTag: [{ tagId: 'setup-old' }],
        teardownTag: [{ tagId: 'teardown-old' }]
      };
      idMapper.add('setup-old', 'setup-new', EntityType.TAG, 'Setup Tag');
      idMapper.add('teardown-old', 'teardown-new', EntityType.TAG, 'Teardown Tag');

      const result = transformer.transformTag(tagWithSequencing);

      // ConfigTransformer converts tagId to tagName for GTM API compatibility
      expect(result.setupTag?.[0].tagName).toBe('Setup Tag');
      expect(result.teardownTag?.[0].tagName).toBe('Teardown Tag');
    });

    it('should preserve tagName if already present', () => {
      const tagWithSequencing: GTMTag = {
        ...sampleTag,
        setupTag: [{ tagName: 'Existing Setup' }],
        teardownTag: [{ tagName: 'Existing Teardown' }]
      };

      const result = transformer.transformTag(tagWithSequencing);

      expect(result.setupTag?.[0].tagName).toBe('Existing Setup');
      expect(result.teardownTag?.[0].tagName).toBe('Existing Teardown');
    });
  });

  describe('transformTag - cvt_ type remapping', () => {
    it('should remap cvt_ type when mapping exists', () => {
      idMapper.addTemplateTypeMapping('cvt_172990757_195', 'cvt_210926331_42');

      const customTemplateTag: GTMTag = {
        tagId: 'tag-642',
        name: 'Custom Template Tag',
        type: 'cvt_172990757_195',
        parameter: [],
        fingerprint: 'fp',
        accountId: 'acc-1',
        containerId: 'con-1',
        workspaceId: 'ws-1'
      };

      const result = transformer.transformTag(customTemplateTag);

      expect(result.type).toBe('cvt_210926331_42');
    });

    it('should keep cvt_ type when no mapping exists', () => {
      const customTemplateTag: GTMTag = {
        tagId: 'tag-642',
        name: 'Custom Template Tag',
        type: 'cvt_172990757_195',
        parameter: [],
        fingerprint: 'fp',
        accountId: 'acc-1',
        containerId: 'con-1',
        workspaceId: 'ws-1'
      };

      const result = transformer.transformTag(customTemplateTag);

      expect(result.type).toBe('cvt_172990757_195');
    });

    it('should not remap non-cvt_ types', () => {
      const standardTag: GTMTag = {
        tagId: 'tag-1',
        name: 'GA4 Tag',
        type: 'gaawe',
        parameter: [],
        fingerprint: 'fp',
        accountId: 'acc-1',
        containerId: 'con-1',
        workspaceId: 'ws-1'
      };

      const result = transformer.transformTag(standardTag);

      expect(result.type).toBe('gaawe');
    });
  });

  describe('extractCreateConfig', () => {
    it('should remove metadata fields from tag', () => {
      const tag: GTMTag = {
        tagId: '123',
        name: 'Test Tag',
        type: 'html',
        parameter: [],
        fingerprint: 'fp123',
        accountId: 'acc',
        containerId: 'con',
        workspaceId: 'ws'
      };

      const config = extractCreateConfig(tag);

      expect(config.name).toBe('Test Tag');
      expect(config.type).toBe('html');
      expect(config.tagId).toBeUndefined();
      expect(config.fingerprint).toBeUndefined();
      expect(config.accountId).toBeUndefined();
      expect(config.containerId).toBeUndefined();
      expect(config.workspaceId).toBeUndefined();
    });

    it('should remove metadata fields from trigger', () => {
      const trigger: GTMTrigger = {
        triggerId: '123',
        name: 'Test Trigger',
        type: 'customEvent',
        fingerprint: 'fp123',
        accountId: 'acc',
        containerId: 'con',
        workspaceId: 'ws'
      };

      const config = extractCreateConfig(trigger);

      expect(config.name).toBe('Test Trigger');
      expect(config.triggerId).toBeUndefined();
      expect(config.fingerprint).toBeUndefined();
    });

    it('should remove metadata fields from variable', () => {
      const variable: GTMVariable = {
        variableId: '123',
        name: 'Test Variable',
        type: 'v',
        parameter: [],
        fingerprint: 'fp123',
        accountId: 'acc',
        containerId: 'con',
        workspaceId: 'ws'
      };

      const config = extractCreateConfig(variable);

      expect(config.name).toBe('Test Variable');
      expect(config.variableId).toBeUndefined();
      expect(config.fingerprint).toBeUndefined();
    });
  });

  describe('compareConfigs', () => {
    it('should detect identical configs', () => {
      const config1 = { name: 'Test', type: 'html' };
      const config2 = { name: 'Test', type: 'html' };

      const result = compareConfigs(config1, config2);

      expect(result.identical).toBe(true);
      expect(result.differences.length).toBe(0);
    });

    it('should detect differences', () => {
      const config1 = { name: 'Test1', type: 'html' };
      const config2 = { name: 'Test2', type: 'html' };

      const result = compareConfigs(config1, config2);

      expect(result.identical).toBe(false);
      expect(result.differences.length).toBe(1);
      expect(result.differences[0].field).toBe('name');
    });

    it('should detect missing fields', () => {
      const config1 = { name: 'Test', type: 'html', extra: 'value' };
      const config2 = { name: 'Test', type: 'html' };

      const result = compareConfigs(config1, config2);

      expect(result.identical).toBe(false);
      expect(result.differences.some(d => d.field === 'extra')).toBe(true);
    });
  });
});
