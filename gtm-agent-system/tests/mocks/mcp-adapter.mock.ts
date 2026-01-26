/**
 * Mock MCP Adapter for Testing
 */

import { GTMTag, GTMTrigger, GTMVariable, GTMTemplate } from 'gtm-agent-skills';

export interface MockMCPAdapterData {
  tags: GTMTag[];
  triggers: GTMTrigger[];
  variables: GTMVariable[];
  templates: GTMTemplate[];
}

export class MockMCPAdapter {
  private data: MockMCPAdapterData;
  private context: { accountId: string; containerId: string; workspaceId: string };

  constructor(
    data: Partial<MockMCPAdapterData> = {},
    context = { accountId: 'acc-1', containerId: 'con-1', workspaceId: 'ws-1' }
  ) {
    this.data = {
      tags: data.tags || [],
      triggers: data.triggers || [],
      variables: data.variables || [],
      templates: data.templates || []
    };
    this.context = context;
  }

  getContext() {
    return this.context;
  }

  // List methods
  async listTags(options?: { refresh?: boolean }): Promise<GTMTag[]> {
    return [...this.data.tags];
  }

  async listTriggers(options?: { refresh?: boolean }): Promise<GTMTrigger[]> {
    return [...this.data.triggers];
  }

  async listVariables(options?: { refresh?: boolean }): Promise<GTMVariable[]> {
    return [...this.data.variables];
  }

  async listTemplates(options?: { refresh?: boolean }): Promise<GTMTemplate[]> {
    return [...this.data.templates];
  }

  // Get by ID methods
  async getTag(tagId: string): Promise<GTMTag | null> {
    return this.data.tags.find(t => t.tagId === tagId) || null;
  }

  async getTrigger(triggerId: string): Promise<GTMTrigger | null> {
    return this.data.triggers.find(t => t.triggerId === triggerId) || null;
  }

  async getVariable(variableId: string): Promise<GTMVariable | null> {
    return this.data.variables.find(v => v.variableId === variableId) || null;
  }

  async getTemplate(templateId: string): Promise<GTMTemplate | null> {
    return this.data.templates.find(t => t.templateId === templateId) || null;
  }

  // Find by name methods
  async findTagByName(name: string): Promise<GTMTag | null> {
    return this.data.tags.find(t => t.name === name) || null;
  }

  async findTriggerByName(name: string): Promise<GTMTrigger | null> {
    return this.data.triggers.find(t => t.name === name) || null;
  }

  async findVariableByName(name: string): Promise<GTMVariable | null> {
    return this.data.variables.find(v => v.name === name) || null;
  }

  async findTemplateByName(name: string): Promise<GTMTemplate | null> {
    return this.data.templates.find(t => t.name === name) || null;
  }

  // Create methods
  async createTag(config: Partial<GTMTag>): Promise<GTMTag> {
    const newTag: GTMTag = {
      tagId: `tag-${Date.now()}`,
      name: config.name || 'New Tag',
      type: config.type || 'html',
      parameter: config.parameter || [],
      fingerprint: 'fp-new',
      accountId: this.context.accountId,
      containerId: this.context.containerId,
      workspaceId: this.context.workspaceId,
      ...config
    };
    this.data.tags.push(newTag);
    return newTag;
  }

  async createTrigger(config: Partial<GTMTrigger>): Promise<GTMTrigger> {
    const newTrigger: GTMTrigger = {
      triggerId: `trigger-${Date.now()}`,
      name: config.name || 'New Trigger',
      type: config.type || 'customEvent',
      fingerprint: 'fp-new',
      accountId: this.context.accountId,
      containerId: this.context.containerId,
      workspaceId: this.context.workspaceId,
      ...config
    };
    this.data.triggers.push(newTrigger);
    return newTrigger;
  }

  async createVariable(config: Partial<GTMVariable>): Promise<GTMVariable> {
    const newVariable: GTMVariable = {
      variableId: `var-${Date.now()}`,
      name: config.name || 'New Variable',
      type: config.type || 'v',
      parameter: config.parameter || [],
      fingerprint: 'fp-new',
      accountId: this.context.accountId,
      containerId: this.context.containerId,
      workspaceId: this.context.workspaceId,
      ...config
    };
    this.data.variables.push(newVariable);
    return newVariable;
  }

  async createTemplate(config: Partial<GTMTemplate>): Promise<GTMTemplate> {
    const newTemplate: GTMTemplate = {
      templateId: `template-${Date.now()}`,
      name: config.name || 'New Template',
      fingerprint: 'fp-new',
      accountId: this.context.accountId,
      containerId: this.context.containerId,
      workspaceId: this.context.workspaceId,
      ...config
    };
    this.data.templates.push(newTemplate);
    return newTemplate;
  }

  // Delete methods
  async deleteTag(tagId: string): Promise<void> {
    const index = this.data.tags.findIndex(t => t.tagId === tagId);
    if (index !== -1) {
      this.data.tags.splice(index, 1);
    }
  }

  async deleteTrigger(triggerId: string): Promise<void> {
    const index = this.data.triggers.findIndex(t => t.triggerId === triggerId);
    if (index !== -1) {
      this.data.triggers.splice(index, 1);
    }
  }

  async deleteVariable(variableId: string): Promise<void> {
    const index = this.data.variables.findIndex(v => v.variableId === variableId);
    if (index !== -1) {
      this.data.variables.splice(index, 1);
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const index = this.data.templates.findIndex(t => t.templateId === templateId);
    if (index !== -1) {
      this.data.templates.splice(index, 1);
    }
  }

  // Test helpers
  setData(data: Partial<MockMCPAdapterData>): void {
    if (data.tags) this.data.tags = data.tags;
    if (data.triggers) this.data.triggers = data.triggers;
    if (data.variables) this.data.variables = data.variables;
    if (data.templates) this.data.templates = data.templates;
  }

  getData(): MockMCPAdapterData {
    return { ...this.data };
  }
}

// Factory function to create sample test data
export function createSampleData(): MockMCPAdapterData {
  return {
    tags: [
      {
        tagId: 'tag-1',
        name: 'GA4 - Homepage - Pageview',
        type: 'gaawe',
        firingTriggerId: ['trigger-1'],
        parameter: [
          { type: 'TEMPLATE', key: 'eventName', value: 'page_view' }
        ],
        fingerprint: 'fp1',
        accountId: 'acc-1',
        containerId: 'con-1',
        workspaceId: 'ws-1'
      },
      {
        tagId: 'tag-2',
        name: 'GA4 - Button - Click',
        type: 'gaawe',
        firingTriggerId: ['trigger-2'],
        parameter: [
          { type: 'TEMPLATE', key: 'eventName', value: 'button_click' }
        ],
        fingerprint: 'fp2',
        accountId: 'acc-1',
        containerId: 'con-1',
        workspaceId: 'ws-1'
      }
    ],
    triggers: [
      {
        triggerId: 'trigger-1',
        name: 'CE - Page View',
        type: 'pageview',
        fingerprint: 'fp1',
        accountId: 'acc-1',
        containerId: 'con-1',
        workspaceId: 'ws-1'
      },
      {
        triggerId: 'trigger-2',
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
        fingerprint: 'fp2',
        accountId: 'acc-1',
        containerId: 'con-1',
        workspaceId: 'ws-1'
      }
    ],
    variables: [
      {
        variableId: 'var-1',
        name: 'DLV - User ID',
        type: 'v',
        parameter: [
          { type: 'TEMPLATE', key: 'name', value: 'user_id' }
        ],
        fingerprint: 'fp1',
        accountId: 'acc-1',
        containerId: 'con-1',
        workspaceId: 'ws-1'
      }
    ],
    templates: []
  };
}
