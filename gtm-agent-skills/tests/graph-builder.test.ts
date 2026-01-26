/**
 * DependencyGraphBuilder Unit Tests
 * - teardownTag/setupTag 생성 순서 검증
 * - 역추적(reverse tracking)이 생성 순서에 영향을 주지 않는지 검증
 */

import { DependencyGraphBuilder, BuildOptions } from '../src/dependency-resolver/graph-builder';
import { GTMTag, GTMTrigger, GTMVariable, GTMTemplate } from '../src/types/gtm';

// Mock MCP Adapter (not used for buildFromEntities, but required by constructor)
const mockAdapter = {
  getTag: async () => null,
  getTrigger: async () => null,
  getVariable: async () => null,
  getTemplate: async () => null,
  findVariableByName: async () => null,
  findTagByName: async () => null,
  listTags: async () => [],
  listTriggers: async () => [],
  listVariables: async () => [],
  listTemplates: async () => [],
};

describe('DependencyGraphBuilder', () => {
  let builder: DependencyGraphBuilder;

  beforeEach(() => {
    builder = new DependencyGraphBuilder(mockAdapter);
  });

  describe('teardownTag creation order', () => {
    // Tag 599 uses tag 601 as teardownTag
    // Correct creation order: 601 BEFORE 599
    const tag599: GTMTag = {
      tagId: '599',
      name: 'GA4 - ETC - Qualified Visit Event',
      type: 'gaawe',
      firingTriggerId: ['589'],
      teardownTag: [{ tagName: 'HTML - Set BDP Event Flag' }],
      parameter: [
        { type: 'TEMPLATE', key: 'eventName', value: 'qualified_visit' }
      ],
      fingerprint: 'fp599',
      accountId: 'acc-1',
      containerId: 'con-1',
      workspaceId: 'ws-1'
    };

    const tag601: GTMTag = {
      tagId: '601',
      name: 'HTML - Set BDP Event Flag',
      type: 'html',
      firingTriggerId: ['589'],
      parameter: [
        { type: 'TEMPLATE', key: 'html', value: '<script>setCookie("bdp_flag","1")</script>' }
      ],
      fingerprint: 'fp601',
      accountId: 'acc-1',
      containerId: 'con-1',
      workspaceId: 'ws-1'
    };

    const trigger589: GTMTrigger = {
      triggerId: '589',
      name: 'CE - Qualified Visit',
      type: 'customEvent',
      customEventFilter: [{
        type: 'EQUALS',
        parameter: [
          { type: 'TEMPLATE', key: 'arg0', value: '{{_event}}' },
          { type: 'TEMPLATE', key: 'arg1', value: 'qualified_visit' }
        ]
      }],
      fingerprint: 'fp589',
      accountId: 'acc-1',
      containerId: 'con-1',
      workspaceId: 'ws-1'
    };

    it('should create teardown tag (601) BEFORE main tag (599) without reverse tracking', () => {
      const graph = builder.buildFromEntities(
        [tag599, tag601],  // selected tags
        [trigger589],
        [],
        undefined,  // no options (no reverse tracking)
        []
      );

      const order = graph.creationOrder;
      const idx599 = order.indexOf('599');
      const idx601 = order.indexOf('601');

      expect(idx601).toBeLessThan(idx599);
    });

    it('should create teardown tag (601) BEFORE main tag (599) WITH reverse tracking', () => {
      const options: BuildOptions = {
        enableReverseTracking: true,
        allWorkspaceTags: [tag599, tag601]
      };

      const graph = builder.buildFromEntities(
        [tag599, tag601],  // selected tags
        [trigger589],
        [],
        options,
        []
      );

      const order = graph.creationOrder;
      const idx599 = order.indexOf('599');
      const idx601 = order.indexOf('601');

      // CRITICAL: 601 must be created BEFORE 599, even with reverse tracking
      expect(idx601).toBeLessThan(idx599);
    });

    it('should discover reverse-tracked tags via BFS without wrong dependency edges', () => {
      // Tag 700 uses tag 601 as teardownTag but is NOT in selected tags
      const tag700: GTMTag = {
        tagId: '700',
        name: 'GA4 - Extra Tag',
        type: 'gaawe',
        firingTriggerId: ['589'],
        teardownTag: [{ tagName: 'HTML - Set BDP Event Flag' }],
        parameter: [],
        fingerprint: 'fp700',
        accountId: 'acc-1',
        containerId: 'con-1',
        workspaceId: 'ws-1'
      };

      const options: BuildOptions = {
        enableReverseTracking: true,
        allWorkspaceTags: [tag599, tag601, tag700]
      };

      // Only select tag 601 - reverse tracking should discover tag 700 (and tag 599)
      const graph = builder.buildFromEntities(
        [tag601],  // only select the teardown tag
        [trigger589],
        [],
        options,
        []
      );

      const order = graph.creationOrder;

      // Tag 700 should be discovered via reverse tracking
      expect(order).toContain('700');
      // Tag 599 should be discovered via reverse tracking
      expect(order).toContain('599');

      // 601 must still come BEFORE 599 and 700 (they depend on 601)
      const idx601 = order.indexOf('601');
      const idx599 = order.indexOf('599');
      const idx700 = order.indexOf('700');

      expect(idx601).toBeLessThan(idx599);
      expect(idx601).toBeLessThan(idx700);
    });
  });

  describe('setupTag creation order', () => {
    const mainTag: GTMTag = {
      tagId: 'main-1',
      name: 'GA4 - Main Tag',
      type: 'gaawe',
      firingTriggerId: ['t-1'],
      setupTag: [{ tagName: 'HTML - Setup Script' }],
      parameter: [],
      fingerprint: 'fp-main',
      accountId: 'acc-1',
      containerId: 'con-1',
      workspaceId: 'ws-1'
    };

    const setupTag: GTMTag = {
      tagId: 'setup-1',
      name: 'HTML - Setup Script',
      type: 'html',
      firingTriggerId: ['t-1'],
      parameter: [],
      fingerprint: 'fp-setup',
      accountId: 'acc-1',
      containerId: 'con-1',
      workspaceId: 'ws-1'
    };

    const trigger: GTMTrigger = {
      triggerId: 't-1',
      name: 'CE - Test',
      type: 'customEvent',
      fingerprint: 'fp-t1',
      accountId: 'acc-1',
      containerId: 'con-1',
      workspaceId: 'ws-1'
    };

    it('should create setup tag BEFORE main tag with reverse tracking', () => {
      const options: BuildOptions = {
        enableReverseTracking: true,
        allWorkspaceTags: [mainTag, setupTag]
      };

      const graph = builder.buildFromEntities(
        [mainTag, setupTag],
        [trigger],
        [],
        options,
        []
      );

      const order = graph.creationOrder;
      const idxMain = order.indexOf('main-1');
      const idxSetup = order.indexOf('setup-1');

      // Setup tag must be created BEFORE main tag
      expect(idxSetup).toBeLessThan(idxMain);
    });
  });

  describe('custom template (cvt_) type resolution', () => {
    const template195: GTMTemplate = {
      templateId: '195',
      name: 'Analytics Web Interface',
      accountId: 'acc-1',
      containerId: '172990757',
      workspaceId: 'ws-1',
      templateData: '{"id":"cvt_temp_public_id","some":"data"}'
    };

    const tag642: GTMTag = {
      tagId: '642',
      name: 'Custom Template Tag',
      type: 'cvt_172990757_195',  // Uses custom template type
      firingTriggerId: ['t-1'],
      parameter: [],
      fingerprint: 'fp642',
      accountId: 'acc-1',
      containerId: '172990757',
      workspaceId: 'ws-1'
    };

    const trigger: GTMTrigger = {
      triggerId: 't-1',
      name: 'CE - Test Event',
      type: 'customEvent',
      fingerprint: 'fp-t1',
      accountId: 'acc-1',
      containerId: '172990757',
      workspaceId: 'ws-1'
    };

    it('should resolve cvt_<containerId>_<templateId> type to template dependency', () => {
      const graph = builder.buildFromEntities(
        [tag642],
        [trigger],
        [],
        undefined,
        [template195]
      );

      const order = graph.creationOrder;

      // Template 195 should be discovered as a dependency of tag 642
      expect(order).toContain('195');
      expect(order).toContain('642');

      // Template must be created BEFORE the tag that uses it
      const idxTemplate = order.indexOf('195');
      const idxTag = order.indexOf('642');
      expect(idxTemplate).toBeLessThan(idxTag);
    });

    it('should resolve cvt_ type even when templateData contains placeholder', () => {
      // templateData has cvt_temp_public_id (placeholder), not the actual container-specific type
      // The resolution should still work via cvt_<containerId>_<templateId> construction
      const templateWithPlaceholder: GTMTemplate = {
        ...template195,
        templateData: '{"id":"cvt_temp_public_id"}'
      };

      const graph = builder.buildFromEntities(
        [tag642],
        [trigger],
        [],
        undefined,
        [templateWithPlaceholder]
      );

      expect(graph.creationOrder).toContain('195');
    });

    it('should also resolve gallery cvt IDs from templateData', () => {
      const galleryTemplate: GTMTemplate = {
        templateId: '583',
        name: 'GTAG GET API',
        accountId: 'acc-1',
        containerId: '172990757',
        workspaceId: 'ws-1',
        templateData: '{"id":"cvt_KDDGR","some":"data"}'
      };

      const tagUsingGallery: GTMTag = {
        tagId: '999',
        name: 'Gallery Template Tag',
        type: 'cvt_KDDGR',  // Uses gallery template ID (not container-specific)
        firingTriggerId: ['t-1'],
        parameter: [],
        fingerprint: 'fp999',
        accountId: 'acc-1',
        containerId: '172990757',
        workspaceId: 'ws-1'
      };

      const graph = builder.buildFromEntities(
        [tagUsingGallery],
        [trigger],
        [],
        undefined,
        [galleryTemplate]
      );

      expect(graph.creationOrder).toContain('583');
      expect(graph.creationOrder).toContain('999');
    });
  });
});
