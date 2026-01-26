/**
 * MCP Adapter
 *
 * GTM MCP Server와의 통신을 추상화하는 어댑터
 * Skills의 GTMMCPAdapter 인터페이스를 구현합니다.
 */

import {
  GTMMCPAdapter,
  GTMTag,
  GTMTrigger,
  GTMVariable,
  GTMTemplate,
  EntityType
} from 'gtm-agent-skills';
import { WorkspaceContext } from '../types/agent';
import { MCPApiError, NotFoundError } from '../utils/error';
import { Logger, createAgentLogger } from '../utils/logger';

// ==================== Types ====================

export interface MCPCallOptions {
  timeout?: number;
  refresh?: boolean;
}

export type MCPCallFn = (
  toolName: string,
  args: Record<string, any>
) => Promise<any>;

// ==================== MCP Adapter Implementation ====================

export class GTMMCPAdapterImpl implements GTMMCPAdapter {
  private mcpCall: MCPCallFn;
  private context: WorkspaceContext;
  private logger: Logger;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL: number = 60000; // 1분

  constructor(
    mcpCall: MCPCallFn,
    context: WorkspaceContext,
    options?: { logger?: Logger; cacheTTL?: number }
  ) {
    this.mcpCall = mcpCall;
    this.context = context;
    this.logger = options?.logger || createAgentLogger('orchestrator');
    if (options?.cacheTTL) this.cacheTTL = options.cacheTTL;
  }

  // ==================== Tag Operations ====================

  async getTag(tagId: string): Promise<GTMTag | null> {
    try {
      const result = await this.mcpCall('gtm_tag', {
        action: 'get',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        tagId
      });

      // get 응답은 data wrapper 없이 직접 반환됨
      return result?.tagId ? result : (result?.data || null);
    } catch (error) {
      this.logger.warn(`Failed to get tag ${tagId}`, error);
      return null;
    }
  }

  async listTags(options?: MCPCallOptions): Promise<GTMTag[]> {
    const cacheKey = `tags:${this.context.workspaceId}`;

    if (!options?.refresh) {
      const cached = this.getFromCache<GTMTag[]>(cacheKey);
      if (cached) return cached;
    }

    const allTags: GTMTag[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.mcpCall('gtm_tag', {
        action: 'list',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        page,
        itemsPerPage: 20,
        refresh: options?.refresh
      });

      if (result?.data) {
        allTags.push(...result.data);
      }

      hasMore = result?.data?.length === 20;
      page++;
    }

    this.setCache(cacheKey, allTags);
    return allTags;
  }

  async findTagByName(name: string): Promise<GTMTag | null> {
    const tags = await this.listTags();
    return tags.find(t => t.name === name) || null;
  }

  async createTag(config: Partial<GTMTag>): Promise<GTMTag> {
    try {
      const result = await this.mcpCall('gtm_tag', {
        action: 'create',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        createOrUpdateConfig: config
      });

      // create 응답은 data wrapper 없이 직접 반환됨
      // result가 tagId를 가지면 직접 반환된 것, result.data가 있으면 wrapped
      const tagData = result?.tagId ? result : result?.data;

      if (!tagData?.tagId) {
        const errorMsg = result?.error || 'No data returned';
        this.logger.error('createTag failed - no data', {
          config: { name: config.name, type: config.type },
          error: errorMsg,
          fullResult: result
        });
        throw new MCPApiError(`Failed to create tag: ${errorMsg}`, { config });
      }

      this.logger.info('Tag created successfully', {
        tagId: tagData.tagId,
        name: tagData.name
      });

      // 캐시 무효화
      this.invalidateCache(`tags:${this.context.workspaceId}`);

      return tagData;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('quota');

      this.logger.error('createTag API call failed', {
        tagName: config.name,
        error: errorMsg,
        isRateLimit,
        stack: error?.stack
      });

      throw error;
    }
  }

  // ==================== Trigger Operations ====================

  async getTrigger(triggerId: string): Promise<GTMTrigger | null> {
    try {
      const result = await this.mcpCall('gtm_trigger', {
        action: 'get',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        triggerId
      });

      // get 응답은 data wrapper 없이 직접 반환됨
      return result?.triggerId ? result : (result?.data || null);
    } catch (error) {
      this.logger.warn(`Failed to get trigger ${triggerId}`, error);
      return null;
    }
  }

  async listTriggers(options?: MCPCallOptions): Promise<GTMTrigger[]> {
    const cacheKey = `triggers:${this.context.workspaceId}`;

    if (!options?.refresh) {
      const cached = this.getFromCache<GTMTrigger[]>(cacheKey);
      if (cached) return cached;
    }

    const allTriggers: GTMTrigger[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.mcpCall('gtm_trigger', {
        action: 'list',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        page,
        itemsPerPage: 20,
        refresh: options?.refresh
      });

      if (result?.data) {
        allTriggers.push(...result.data);
      }

      hasMore = result?.data?.length === 20;
      page++;
    }

    this.setCache(cacheKey, allTriggers);
    return allTriggers;
  }

  async findTriggerByName(name: string): Promise<GTMTrigger | null> {
    const triggers = await this.listTriggers();
    return triggers.find(t => t.name === name) || null;
  }

  async createTrigger(config: Partial<GTMTrigger>): Promise<GTMTrigger> {
    try {
      const result = await this.mcpCall('gtm_trigger', {
        action: 'create',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        createOrUpdateConfig: config
      });

      // create 응답은 data wrapper 없이 직접 반환됨
      const triggerData = result?.triggerId ? result : result?.data;

      if (!triggerData?.triggerId) {
        const errorMsg = result?.error || 'No data returned';
        this.logger.error('createTrigger failed - no data', {
          config: { name: config.name, type: config.type },
          error: errorMsg,
          fullResult: result
        });
        throw new MCPApiError(`Failed to create trigger: ${errorMsg}`, { config });
      }

      this.logger.info('Trigger created successfully', {
        triggerId: triggerData.triggerId,
        name: triggerData.name
      });

      this.invalidateCache(`triggers:${this.context.workspaceId}`);
      return triggerData;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('quota');

      this.logger.error('createTrigger API call failed', {
        triggerName: config.name,
        error: errorMsg,
        isRateLimit,
        stack: error?.stack
      });

      throw error;
    }
  }

  // ==================== Variable Operations ====================

  async getVariable(variableId: string): Promise<GTMVariable | null> {
    try {
      const result = await this.mcpCall('gtm_variable', {
        action: 'get',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        variableId
      });

      // get 응답은 data wrapper 없이 직접 반환됨
      return result?.variableId ? result : (result?.data || null);
    } catch (error) {
      this.logger.warn(`Failed to get variable ${variableId}`, error);
      return null;
    }
  }

  async listVariables(options?: MCPCallOptions): Promise<GTMVariable[]> {
    const cacheKey = `variables:${this.context.workspaceId}`;

    if (!options?.refresh) {
      const cached = this.getFromCache<GTMVariable[]>(cacheKey);
      if (cached) return cached;
    }

    const allVariables: GTMVariable[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.mcpCall('gtm_variable', {
        action: 'list',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        page,
        itemsPerPage: 20,
        refresh: options?.refresh
      });

      if (result?.data) {
        allVariables.push(...result.data);
      }

      hasMore = result?.data?.length === 20;
      page++;
    }

    this.setCache(cacheKey, allVariables);
    return allVariables;
  }

  async findVariableByName(name: string): Promise<GTMVariable | null> {
    const variables = await this.listVariables();
    return variables.find(v => v.name === name) || null;
  }

  async createVariable(config: Partial<GTMVariable>): Promise<GTMVariable> {
    try {
      const result = await this.mcpCall('gtm_variable', {
        action: 'create',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        createOrUpdateConfig: config
      });

      // create 응답은 data wrapper 없이 직접 반환됨
      const variableData = result?.variableId ? result : result?.data;

      if (!variableData?.variableId) {
        const errorMsg = result?.error || 'No data returned';
        this.logger.error('createVariable failed - no data', {
          config: { name: config.name, type: config.type },
          error: errorMsg,
          fullResult: result
        });
        throw new MCPApiError(`Failed to create variable: ${errorMsg}`, { config });
      }

      this.logger.info('Variable created successfully', {
        variableId: variableData.variableId,
        name: variableData.name
      });

      this.invalidateCache(`variables:${this.context.workspaceId}`);
      return variableData;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('quota');

      this.logger.error('createVariable API call failed', {
        variableName: config.name,
        error: errorMsg,
        isRateLimit,
        stack: error?.stack
      });

      throw error;
    }
  }

  // ==================== Template Operations ====================

  async getTemplate(templateId: string): Promise<GTMTemplate | null> {
    try {
      const result = await this.mcpCall('gtm_template', {
        action: 'get',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        templateId
      });

      // get 응답은 data wrapper 없이 직접 반환됨
      return result?.templateId ? result : (result?.data || null);
    } catch (error) {
      this.logger.warn(`Failed to get template ${templateId}`, error);
      return null;
    }
  }

  async listTemplates(options?: MCPCallOptions): Promise<GTMTemplate[]> {
    const cacheKey = `templates:${this.context.workspaceId}`;

    if (!options?.refresh) {
      const cached = this.getFromCache<GTMTemplate[]>(cacheKey);
      if (cached) return cached;
    }

    const allTemplates: GTMTemplate[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.mcpCall('gtm_template', {
        action: 'list',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        page,
        itemsPerPage: 20
      });

      if (result?.data) {
        allTemplates.push(...result.data);
      }

      hasMore = result?.data?.length === 20;
      page++;
    }

    this.setCache(cacheKey, allTemplates);
    return allTemplates;
  }

  async findTemplateByName(name: string): Promise<GTMTemplate | null> {
    const templates = await this.listTemplates();
    return templates.find(t => t.name === name) || null;
  }

  async createTemplate(config: Partial<GTMTemplate>): Promise<GTMTemplate> {
    try {
      const result = await this.mcpCall('gtm_template', {
        action: 'create',
        accountId: this.context.accountId,
        containerId: this.context.containerId,
        workspaceId: this.context.workspaceId,
        createOrUpdateConfig: config
      });

      // create 응답은 data wrapper 없이 직접 반환됨
      const templateData = result?.templateId ? result : result?.data;

      if (!templateData?.templateId) {
        const errorMsg = result?.error || 'No data returned';
        this.logger.error('createTemplate failed - no data', {
          config: { name: config.name },
          error: errorMsg,
          fullResult: result
        });
        throw new MCPApiError(`Failed to create template: ${errorMsg}`, { config });
      }

      this.logger.info('Template created successfully', {
        templateId: templateData.templateId,
        name: templateData.name
      });

      this.invalidateCache(`templates:${this.context.workspaceId}`);
      return templateData;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('quota');

      this.logger.error('createTemplate API call failed', {
        templateName: config.name,
        error: errorMsg,
        isRateLimit,
        stack: error?.stack
      });

      throw error;
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.mcpCall('gtm_template', {
      action: 'remove',
      accountId: this.context.accountId,
      containerId: this.context.containerId,
      workspaceId: this.context.workspaceId,
      templateId
    });

    this.invalidateCache(`templates:${this.context.workspaceId}`);
  }

  // ==================== Delete Operations ====================

  async deleteTag(tagId: string): Promise<void> {
    await this.mcpCall('gtm_tag', {
      action: 'remove',
      accountId: this.context.accountId,
      containerId: this.context.containerId,
      workspaceId: this.context.workspaceId,
      tagId
    });

    this.invalidateCache(`tags:${this.context.workspaceId}`);
  }

  async deleteTrigger(triggerId: string): Promise<void> {
    await this.mcpCall('gtm_trigger', {
      action: 'remove',
      accountId: this.context.accountId,
      containerId: this.context.containerId,
      workspaceId: this.context.workspaceId,
      triggerId
    });

    this.invalidateCache(`triggers:${this.context.workspaceId}`);
  }

  async deleteVariable(variableId: string): Promise<void> {
    await this.mcpCall('gtm_variable', {
      action: 'remove',
      accountId: this.context.accountId,
      containerId: this.context.containerId,
      workspaceId: this.context.workspaceId,
      variableId
    });

    this.invalidateCache(`variables:${this.context.workspaceId}`);
  }

  // ==================== Cache Management ====================

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  clearCache(): void {
    this.cache.clear();
  }

  // ==================== Context Management ====================

  updateContext(context: Partial<WorkspaceContext>): void {
    Object.assign(this.context, context);
    this.clearCache();
  }

  getContext(): WorkspaceContext {
    return { ...this.context };
  }
}

// ==================== Factory Function ====================

export function createMCPAdapter(
  mcpCall: MCPCallFn,
  context: WorkspaceContext,
  options?: { logger?: Logger; cacheTTL?: number }
): GTMMCPAdapterImpl {
  return new GTMMCPAdapterImpl(mcpCall, context, options);
}
