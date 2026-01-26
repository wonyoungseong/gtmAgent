"use strict";
/**
 * MCP Adapter
 *
 * GTM MCP Server와의 통신을 추상화하는 어댑터
 * Skills의 GTMMCPAdapter 인터페이스를 구현합니다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GTMMCPAdapterImpl = void 0;
exports.createMCPAdapter = createMCPAdapter;
const error_1 = require("../utils/error");
const logger_1 = require("../utils/logger");
// ==================== MCP Adapter Implementation ====================
class GTMMCPAdapterImpl {
    constructor(mcpCall, context, options) {
        this.cache = new Map();
        this.cacheTTL = 60000; // 1분
        this.mcpCall = mcpCall;
        this.context = context;
        this.logger = options?.logger || (0, logger_1.createAgentLogger)('orchestrator');
        if (options?.cacheTTL)
            this.cacheTTL = options.cacheTTL;
    }
    // ==================== Tag Operations ====================
    async getTag(tagId) {
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
        }
        catch (error) {
            this.logger.warn(`Failed to get tag ${tagId}`, error);
            return null;
        }
    }
    async listTags(options) {
        const cacheKey = `tags:${this.context.workspaceId}`;
        if (!options?.refresh) {
            const cached = this.getFromCache(cacheKey);
            if (cached)
                return cached;
        }
        const allTags = [];
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
    async findTagByName(name) {
        const tags = await this.listTags();
        return tags.find(t => t.name === name) || null;
    }
    async createTag(config) {
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
                throw new error_1.MCPApiError(`Failed to create tag: ${errorMsg}`, { config });
            }
            this.logger.info('Tag created successfully', {
                tagId: tagData.tagId,
                name: tagData.name
            });
            // 캐시 무효화
            this.invalidateCache(`tags:${this.context.workspaceId}`);
            return tagData;
        }
        catch (error) {
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
    async getTrigger(triggerId) {
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
        }
        catch (error) {
            this.logger.warn(`Failed to get trigger ${triggerId}`, error);
            return null;
        }
    }
    async listTriggers(options) {
        const cacheKey = `triggers:${this.context.workspaceId}`;
        if (!options?.refresh) {
            const cached = this.getFromCache(cacheKey);
            if (cached)
                return cached;
        }
        const allTriggers = [];
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
    async findTriggerByName(name) {
        const triggers = await this.listTriggers();
        return triggers.find(t => t.name === name) || null;
    }
    async createTrigger(config) {
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
                throw new error_1.MCPApiError(`Failed to create trigger: ${errorMsg}`, { config });
            }
            this.logger.info('Trigger created successfully', {
                triggerId: triggerData.triggerId,
                name: triggerData.name
            });
            this.invalidateCache(`triggers:${this.context.workspaceId}`);
            return triggerData;
        }
        catch (error) {
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
    async getVariable(variableId) {
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
        }
        catch (error) {
            this.logger.warn(`Failed to get variable ${variableId}`, error);
            return null;
        }
    }
    async listVariables(options) {
        const cacheKey = `variables:${this.context.workspaceId}`;
        if (!options?.refresh) {
            const cached = this.getFromCache(cacheKey);
            if (cached)
                return cached;
        }
        const allVariables = [];
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
    async findVariableByName(name) {
        const variables = await this.listVariables();
        return variables.find(v => v.name === name) || null;
    }
    async createVariable(config) {
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
                throw new error_1.MCPApiError(`Failed to create variable: ${errorMsg}`, { config });
            }
            this.logger.info('Variable created successfully', {
                variableId: variableData.variableId,
                name: variableData.name
            });
            this.invalidateCache(`variables:${this.context.workspaceId}`);
            return variableData;
        }
        catch (error) {
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
    async getTemplate(templateId) {
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
        }
        catch (error) {
            this.logger.warn(`Failed to get template ${templateId}`, error);
            return null;
        }
    }
    async listTemplates(options) {
        const cacheKey = `templates:${this.context.workspaceId}`;
        if (!options?.refresh) {
            const cached = this.getFromCache(cacheKey);
            if (cached)
                return cached;
        }
        const allTemplates = [];
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
    async findTemplateByName(name) {
        const templates = await this.listTemplates();
        return templates.find(t => t.name === name) || null;
    }
    async createTemplate(config) {
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
                throw new error_1.MCPApiError(`Failed to create template: ${errorMsg}`, { config });
            }
            this.logger.info('Template created successfully', {
                templateId: templateData.templateId,
                name: templateData.name
            });
            this.invalidateCache(`templates:${this.context.workspaceId}`);
            return templateData;
        }
        catch (error) {
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
    async deleteTemplate(templateId) {
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
    async deleteTag(tagId) {
        await this.mcpCall('gtm_tag', {
            action: 'remove',
            accountId: this.context.accountId,
            containerId: this.context.containerId,
            workspaceId: this.context.workspaceId,
            tagId
        });
        this.invalidateCache(`tags:${this.context.workspaceId}`);
    }
    async deleteTrigger(triggerId) {
        await this.mcpCall('gtm_trigger', {
            action: 'remove',
            accountId: this.context.accountId,
            containerId: this.context.containerId,
            workspaceId: this.context.workspaceId,
            triggerId
        });
        this.invalidateCache(`triggers:${this.context.workspaceId}`);
    }
    async deleteVariable(variableId) {
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
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        return null;
    }
    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
    invalidateCache(key) {
        this.cache.delete(key);
    }
    clearCache() {
        this.cache.clear();
    }
    // ==================== Context Management ====================
    updateContext(context) {
        Object.assign(this.context, context);
        this.clearCache();
    }
    getContext() {
        return { ...this.context };
    }
}
exports.GTMMCPAdapterImpl = GTMMCPAdapterImpl;
// ==================== Factory Function ====================
function createMCPAdapter(mcpCall, context, options) {
    return new GTMMCPAdapterImpl(mcpCall, context, options);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLWFkYXB0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYWRhcHRlcnMvbWNwLWFkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7OztHQUtHOzs7QUEwaUJILDRDQU1DO0FBcmlCRCwwQ0FBNEQ7QUFDNUQsNENBQTREO0FBYzVELHVFQUF1RTtBQUV2RSxNQUFhLGlCQUFpQjtJQU81QixZQUNFLE9BQWtCLEVBQ2xCLE9BQXlCLEVBQ3pCLE9BQWdEO1FBTjFDLFVBQUssR0FBa0QsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNqRSxhQUFRLEdBQVcsS0FBSyxDQUFDLENBQUMsS0FBSztRQU9yQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sRUFBRSxNQUFNLElBQUksSUFBQSwwQkFBaUIsRUFBQyxjQUFjLENBQUMsQ0FBQztRQUNuRSxJQUFJLE9BQU8sRUFBRSxRQUFRO1lBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDO0lBQzFELENBQUM7SUFFRCwyREFBMkQ7SUFFM0QsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFhO1FBQ3hCLElBQUksQ0FBQztZQUNILE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUU7Z0JBQzNDLE1BQU0sRUFBRSxLQUFLO2dCQUNiLFNBQVMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVM7Z0JBQ2pDLFdBQVcsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVc7Z0JBQ3JDLFdBQVcsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVc7Z0JBQ3JDLEtBQUs7YUFDTixDQUFDLENBQUM7WUFFSCxpQ0FBaUM7WUFDakMsT0FBTyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxN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QUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRU8sZUFBZSxDQUFDLEdBQVc7UUFDakMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDekIsQ0FBQztJQUVELFVBQVU7UUFDUixJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3JCLENBQUM7SUFFRCwrREFBK0Q7SUFFL0QsYUFBYSxDQUFDLE9BQWtDO1FBQzlDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVELFVBQVU7UUFDUixPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDN0IsQ0FBQztDQUNGO0FBMWdCRCw4Q0EwZ0JDO0FBRUQsNkRBQTZEO0FBRTdELFNBQWdCLGdCQUFnQixDQUM5QixPQUFrQixFQUNsQixPQUF5QixFQUN6QixPQUFnRDtJQUVoRCxPQUFPLElBQUksaUJBQWlCLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMxRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIE1DUCBBZGFwdGVyXHJcbiAqXHJcbiAqIEdUTSBNQ1AgU2VydmVy7JmA7J2YIO2GteyLoOydhCDstpTsg4HtmZTtlZjripQg7Ja064yR7YSwXHJcbiAqIFNraWxsc+ydmCBHVE1NQ1BBZGFwdGVyIOyduO2EsO2OmOydtOyKpOulvCDqtaztmITtlanri4jri6QuXHJcbiAqL1xyXG5cclxuaW1wb3J0IHtcclxuICBHVE1NQ1BBZGFwdGVyLFxyXG4gIEdUTVRhZyxcclxuICBHVE1UcmlnZ2VyLFxyXG4gIEdUTVZhcmlhYmxlLFxyXG4gIEdUTVRlbXBsYXRlLFxyXG4gIEVudGl0eVR5cGVcclxufSBmcm9tICdndG0tYWdlbnQtc2tpbGxzJztcclxuaW1wb3J0IHsgV29ya3NwYWNlQ29udGV4dCB9IGZyb20gJy4uL3R5cGVzL2FnZW50JztcclxuaW1wb3J0IHsgTUNQQXBpRXJyb3IsIE5vdEZvdW5kRXJyb3IgfSBmcm9tICcuLi91dGlscy9lcnJvcic7XHJcbmltcG9ydCB7IExvZ2dlciwgY3JlYXRlQWdlbnRMb2dnZXIgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT0gVHlwZXMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTUNQQ2FsbE9wdGlvbnMge1xyXG4gIHRpbWVvdXQ/OiBudW1iZXI7XHJcbiAgcmVmcmVzaD86IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCB0eXBlIE1DUENhbGxGbiA9IChcclxuICB0b29sTmFtZTogc3RyaW5nLFxyXG4gIGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT5cclxuKSA9PiBQcm9taXNlPGFueT47XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBNQ1AgQWRhcHRlciBJbXBsZW1lbnRhdGlvbiA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuZXhwb3J0IGNsYXNzIEdUTU1DUEFkYXB0ZXJJbXBsIGltcGxlbWVudHMgR1RNTUNQQWRhcHRlciB7XHJcbiAgcHJpdmF0ZSBtY3BDYWxsOiBNQ1BDYWxsRm47XHJcbiAgcHJpdmF0ZSBjb250ZXh0OiBXb3Jrc3BhY2VDb250ZXh0O1xyXG4gIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XHJcbiAgcHJpdmF0ZSBjYWNoZTogTWFwPHN0cmluZywgeyBkYXRhOiBhbnk7IHRpbWVzdGFtcDogbnVtYmVyIH0+ID0gbmV3IE1hcCgpO1xyXG4gIHByaXZhdGUgY2FjaGVUVEw6IG51bWJlciA9IDYwMDAwOyAvLyAx67aEXHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgbWNwQ2FsbDogTUNQQ2FsbEZuLFxyXG4gICAgY29udGV4dDogV29ya3NwYWNlQ29udGV4dCxcclxuICAgIG9wdGlvbnM/OiB7IGxvZ2dlcj86IExvZ2dlcjsgY2FjaGVUVEw/OiBudW1iZXIgfVxyXG4gICkge1xyXG4gICAgdGhpcy5tY3BDYWxsID0gbWNwQ2FsbDtcclxuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XHJcbiAgICB0aGlzLmxvZ2dlciA9IG9wdGlvbnM/LmxvZ2dlciB8fCBjcmVhdGVBZ2VudExvZ2dlcignb3JjaGVzdHJhdG9yJyk7XHJcbiAgICBpZiAob3B0aW9ucz8uY2FjaGVUVEwpIHRoaXMuY2FjaGVUVEwgPSBvcHRpb25zLmNhY2hlVFRMO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gVGFnIE9wZXJhdGlvbnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgYXN5bmMgZ2V0VGFnKHRhZ0lkOiBzdHJpbmcpOiBQcm9taXNlPEdUTVRhZyB8IG51bGw+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubWNwQ2FsbCgnZ3RtX3RhZycsIHtcclxuICAgICAgICBhY3Rpb246ICdnZXQnLFxyXG4gICAgICAgIGFjY291bnRJZDogdGhpcy5jb250ZXh0LmFjY291bnRJZCxcclxuICAgICAgICBjb250YWluZXJJZDogdGhpcy5jb250ZXh0LmNvbnRhaW5lcklkLFxyXG4gICAgICAgIHdvcmtzcGFjZUlkOiB0aGlzLmNvbnRleHQud29ya3NwYWNlSWQsXHJcbiAgICAgICAgdGFnSWRcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBnZXQg7J2R64u17J2AIGRhdGEgd3JhcHBlciDsl4bsnbQg7KeB7KCRIOuwmO2ZmOuQqFxyXG4gICAgICByZXR1cm4gcmVzdWx0Py50YWdJZCA/IHJlc3VsdCA6IChyZXN1bHQ/LmRhdGEgfHwgbnVsbCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLmxvZ2dlci53YXJuKGBGYWlsZWQgdG8gZ2V0IHRhZyAke3RhZ0lkfWAsIGVycm9yKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBsaXN0VGFncyhvcHRpb25zPzogTUNQQ2FsbE9wdGlvbnMpOiBQcm9taXNlPEdUTVRhZ1tdPiB7XHJcbiAgICBjb25zdCBjYWNoZUtleSA9IGB0YWdzOiR7dGhpcy5jb250ZXh0LndvcmtzcGFjZUlkfWA7XHJcblxyXG4gICAgaWYgKCFvcHRpb25zPy5yZWZyZXNoKSB7XHJcbiAgICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZ2V0RnJvbUNhY2hlPEdUTVRhZ1tdPihjYWNoZUtleSk7XHJcbiAgICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgYWxsVGFnczogR1RNVGFnW10gPSBbXTtcclxuICAgIGxldCBwYWdlID0gMTtcclxuICAgIGxldCBoYXNNb3JlID0gdHJ1ZTtcclxuXHJcbiAgICB3aGlsZSAoaGFzTW9yZSkge1xyXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLm1jcENhbGwoJ2d0bV90YWcnLCB7XHJcbiAgICAgICAgYWN0aW9uOiAnbGlzdCcsXHJcbiAgICAgICAgYWNjb3VudElkOiB0aGlzLmNvbnRleHQuYWNjb3VudElkLFxyXG4gICAgICAgIGNvbnRhaW5lcklkOiB0aGlzLmNvbnRleHQuY29udGFpbmVySWQsXHJcbiAgICAgICAgd29ya3NwYWNlSWQ6IHRoaXMuY29udGV4dC53b3Jrc3BhY2VJZCxcclxuICAgICAgICBwYWdlLFxyXG4gICAgICAgIGl0ZW1zUGVyUGFnZTogMjAsXHJcbiAgICAgICAgcmVmcmVzaDogb3B0aW9ucz8ucmVmcmVzaFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmIChyZXN1bHQ/LmRhdGEpIHtcclxuICAgICAgICBhbGxUYWdzLnB1c2goLi4ucmVzdWx0LmRhdGEpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBoYXNNb3JlID0gcmVzdWx0Py5kYXRhPy5sZW5ndGggPT09IDIwO1xyXG4gICAgICBwYWdlKys7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5zZXRDYWNoZShjYWNoZUtleSwgYWxsVGFncyk7XHJcbiAgICByZXR1cm4gYWxsVGFncztcclxuICB9XHJcblxyXG4gIGFzeW5jIGZpbmRUYWdCeU5hbWUobmFtZTogc3RyaW5nKTogUHJvbWlzZTxHVE1UYWcgfCBudWxsPiB7XHJcbiAgICBjb25zdCB0YWdzID0gYXdhaXQgdGhpcy5saXN0VGFncygpO1xyXG4gICAgcmV0dXJuIHRhZ3MuZmluZCh0ID0+IHQubmFtZSA9PT0gbmFtZSkgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIGFzeW5jIGNyZWF0ZVRhZyhjb25maWc6IFBhcnRpYWw8R1RNVGFnPik6IFByb21pc2U8R1RNVGFnPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLm1jcENhbGwoJ2d0bV90YWcnLCB7XHJcbiAgICAgICAgYWN0aW9uOiAnY3JlYXRlJyxcclxuICAgICAgICBhY2NvdW50SWQ6IHRoaXMuY29udGV4dC5hY2NvdW50SWQsXHJcbiAgICAgICAgY29udGFpbmVySWQ6IHRoaXMuY29udGV4dC5jb250YWluZXJJZCxcclxuICAgICAgICB3b3Jrc3BhY2VJZDogdGhpcy5jb250ZXh0LndvcmtzcGFjZUlkLFxyXG4gICAgICAgIGNyZWF0ZU9yVXBkYXRlQ29uZmlnOiBjb25maWdcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBjcmVhdGUg7J2R64u17J2AIGRhdGEgd3JhcHBlciDsl4bsnbQg7KeB7KCRIOuwmO2ZmOuQqFxyXG4gICAgICAvLyByZXN1bHTqsIAgdGFnSWTrpbwg6rCA7KeA66m0IOyngeygkSDrsJjtmZjrkJwg6rKDLCByZXN1bHQuZGF0YeqwgCDsnojsnLzrqbQgd3JhcHBlZFxyXG4gICAgICBjb25zdCB0YWdEYXRhID0gcmVzdWx0Py50YWdJZCA/IHJlc3VsdCA6IHJlc3VsdD8uZGF0YTtcclxuXHJcbiAgICAgIGlmICghdGFnRGF0YT8udGFnSWQpIHtcclxuICAgICAgICBjb25zdCBlcnJvck1zZyA9IHJlc3VsdD8uZXJyb3IgfHwgJ05vIGRhdGEgcmV0dXJuZWQnO1xyXG4gICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdjcmVhdGVUYWcgZmFpbGVkIC0gbm8gZGF0YScsIHtcclxuICAgICAgICAgIGNvbmZpZzogeyBuYW1lOiBjb25maWcubmFtZSwgdHlwZTogY29uZmlnLnR5cGUgfSxcclxuICAgICAgICAgIGVycm9yOiBlcnJvck1zZyxcclxuICAgICAgICAgIGZ1bGxSZXN1bHQ6IHJlc3VsdFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRocm93IG5ldyBNQ1BBcGlFcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSB0YWc6ICR7ZXJyb3JNc2d9YCwgeyBjb25maWcgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ1RhZyBjcmVhdGVkIHN1Y2Nlc3NmdWxseScsIHtcclxuICAgICAgICB0YWdJZDogdGFnRGF0YS50YWdJZCxcclxuICAgICAgICBuYW1lOiB0YWdEYXRhLm5hbWVcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyDsupDsi5wg66y07Zqo7ZmUXHJcbiAgICAgIHRoaXMuaW52YWxpZGF0ZUNhY2hlKGB0YWdzOiR7dGhpcy5jb250ZXh0LndvcmtzcGFjZUlkfWApO1xyXG5cclxuICAgICAgcmV0dXJuIHRhZ0RhdGE7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3I/Lm1lc3NhZ2UgfHwgU3RyaW5nKGVycm9yKTtcclxuICAgICAgY29uc3QgaXNSYXRlTGltaXQgPSBlcnJvck1zZy5pbmNsdWRlcygnNDI5JykgfHwgZXJyb3JNc2cuaW5jbHVkZXMoJ3JhdGUnKSB8fCBlcnJvck1zZy5pbmNsdWRlcygncXVvdGEnKTtcclxuXHJcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdjcmVhdGVUYWcgQVBJIGNhbGwgZmFpbGVkJywge1xyXG4gICAgICAgIHRhZ05hbWU6IGNvbmZpZy5uYW1lLFxyXG4gICAgICAgIGVycm9yOiBlcnJvck1zZyxcclxuICAgICAgICBpc1JhdGVMaW1pdCxcclxuICAgICAgICBzdGFjazogZXJyb3I/LnN0YWNrXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBUcmlnZ2VyIE9wZXJhdGlvbnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgYXN5bmMgZ2V0VHJpZ2dlcih0cmlnZ2VySWQ6IHN0cmluZyk6IFByb21pc2U8R1RNVHJpZ2dlciB8IG51bGw+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubWNwQ2FsbCgnZ3RtX3RyaWdnZXInLCB7XHJcbiAgICAgICAgYWN0aW9uOiAnZ2V0JyxcclxuICAgICAgICBhY2NvdW50SWQ6IHRoaXMuY29udGV4dC5hY2NvdW50SWQsXHJcbiAgICAgICAgY29udGFpbmVySWQ6IHRoaXMuY29udGV4dC5jb250YWluZXJJZCxcclxuICAgICAgICB3b3Jrc3BhY2VJZDogdGhpcy5jb250ZXh0LndvcmtzcGFjZUlkLFxyXG4gICAgICAgIHRyaWdnZXJJZFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIGdldCDsnZHri7XsnYAgZGF0YSB3cmFwcGVyIOyXhuydtCDsp4HsoJEg67CY7ZmY65CoXHJcbiAgICAgIHJldHVybiByZXN1bHQ/LnRyaWdnZXJJZCA/IHJlc3VsdCA6IChyZXN1bHQ/LmRhdGEgfHwgbnVsbCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLmxvZ2dlci53YXJuKGBGYWlsZWQgdG8gZ2V0IHRyaWdnZXIgJHt0cmlnZ2VySWR9YCwgZXJyb3IpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGxpc3RUcmlnZ2VycyhvcHRpb25zPzogTUNQQ2FsbE9wdGlvbnMpOiBQcm9taXNlPEdUTVRyaWdnZXJbXT4ge1xyXG4gICAgY29uc3QgY2FjaGVLZXkgPSBgdHJpZ2dlcnM6JHt0aGlzLmNvbnRleHQud29ya3NwYWNlSWR9YDtcclxuXHJcbiAgICBpZiAoIW9wdGlvbnM/LnJlZnJlc2gpIHtcclxuICAgICAgY29uc3QgY2FjaGVkID0gdGhpcy5nZXRGcm9tQ2FjaGU8R1RNVHJpZ2dlcltdPihjYWNoZUtleSk7XHJcbiAgICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgYWxsVHJpZ2dlcnM6IEdUTVRyaWdnZXJbXSA9IFtdO1xyXG4gICAgbGV0IHBhZ2UgPSAxO1xyXG4gICAgbGV0IGhhc01vcmUgPSB0cnVlO1xyXG5cclxuICAgIHdoaWxlIChoYXNNb3JlKSB7XHJcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubWNwQ2FsbCgnZ3RtX3RyaWdnZXInLCB7XHJcbiAgICAgICAgYWN0aW9uOiAnbGlzdCcsXHJcbiAgICAgICAgYWNjb3VudElkOiB0aGlzLmNvbnRleHQuYWNjb3VudElkLFxyXG4gICAgICAgIGNvbnRhaW5lcklkOiB0aGlzLmNvbnRleHQuY29udGFpbmVySWQsXHJcbiAgICAgICAgd29ya3NwYWNlSWQ6IHRoaXMuY29udGV4dC53b3Jrc3BhY2VJZCxcclxuICAgICAgICBwYWdlLFxyXG4gICAgICAgIGl0ZW1zUGVyUGFnZTogMjAsXHJcbiAgICAgICAgcmVmcmVzaDogb3B0aW9ucz8ucmVmcmVzaFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmIChyZXN1bHQ/LmRhdGEpIHtcclxuICAgICAgICBhbGxUcmlnZ2Vycy5wdXNoKC4uLnJlc3VsdC5kYXRhKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaGFzTW9yZSA9IHJlc3VsdD8uZGF0YT8ubGVuZ3RoID09PSAyMDtcclxuICAgICAgcGFnZSsrO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuc2V0Q2FjaGUoY2FjaGVLZXksIGFsbFRyaWdnZXJzKTtcclxuICAgIHJldHVybiBhbGxUcmlnZ2VycztcclxuICB9XHJcblxyXG4gIGFzeW5jIGZpbmRUcmlnZ2VyQnlOYW1lKG5hbWU6IHN0cmluZyk6IFByb21pc2U8R1RNVHJpZ2dlciB8IG51bGw+IHtcclxuICAgIGNvbnN0IHRyaWdnZXJzID0gYXdhaXQgdGhpcy5saXN0VHJpZ2dlcnMoKTtcclxuICAgIHJldHVybiB0cmlnZ2Vycy5maW5kKHQgPT4gdC5uYW1lID09PSBuYW1lKSB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgY3JlYXRlVHJpZ2dlcihjb25maWc6IFBhcnRpYWw8R1RNVHJpZ2dlcj4pOiBQcm9taXNlPEdUTVRyaWdnZXI+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubWNwQ2FsbCgnZ3RtX3RyaWdnZXInLCB7XHJcbiAgICAgICAgYWN0aW9uOiAnY3JlYXRlJyxcclxuICAgICAgICBhY2NvdW50SWQ6IHRoaXMuY29udGV4dC5hY2NvdW50SWQsXHJcbiAgICAgICAgY29udGFpbmVySWQ6IHRoaXMuY29udGV4dC5jb250YWluZXJJZCxcclxuICAgICAgICB3b3Jrc3BhY2VJZDogdGhpcy5jb250ZXh0LndvcmtzcGFjZUlkLFxyXG4gICAgICAgIGNyZWF0ZU9yVXBkYXRlQ29uZmlnOiBjb25maWdcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBjcmVhdGUg7J2R64u17J2AIGRhdGEgd3JhcHBlciDsl4bsnbQg7KeB7KCRIOuwmO2ZmOuQqFxyXG4gICAgICBjb25zdCB0cmlnZ2VyRGF0YSA9IHJlc3VsdD8udHJpZ2dlcklkID8gcmVzdWx0IDogcmVzdWx0Py5kYXRhO1xyXG5cclxuICAgICAgaWYgKCF0cmlnZ2VyRGF0YT8udHJpZ2dlcklkKSB7XHJcbiAgICAgICAgY29uc3QgZXJyb3JNc2cgPSByZXN1bHQ/LmVycm9yIHx8ICdObyBkYXRhIHJldHVybmVkJztcclxuICAgICAgICB0aGlzLmxvZ2dlci5lcnJvcignY3JlYXRlVHJpZ2dlciBmYWlsZWQgLSBubyBkYXRhJywge1xyXG4gICAgICAgICAgY29uZmlnOiB7IG5hbWU6IGNvbmZpZy5uYW1lLCB0eXBlOiBjb25maWcudHlwZSB9LFxyXG4gICAgICAgICAgZXJyb3I6IGVycm9yTXNnLFxyXG4gICAgICAgICAgZnVsbFJlc3VsdDogcmVzdWx0XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhyb3cgbmV3IE1DUEFwaUVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIHRyaWdnZXI6ICR7ZXJyb3JNc2d9YCwgeyBjb25maWcgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ1RyaWdnZXIgY3JlYXRlZCBzdWNjZXNzZnVsbHknLCB7XHJcbiAgICAgICAgdHJpZ2dlcklkOiB0cmlnZ2VyRGF0YS50cmlnZ2VySWQsXHJcbiAgICAgICAgbmFtZTogdHJpZ2dlckRhdGEubmFtZVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHRoaXMuaW52YWxpZGF0ZUNhY2hlKGB0cmlnZ2Vyczoke3RoaXMuY29udGV4dC53b3Jrc3BhY2VJZH1gKTtcclxuICAgICAgcmV0dXJuIHRyaWdnZXJEYXRhO1xyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICBjb25zdCBlcnJvck1zZyA9IGVycm9yPy5tZXNzYWdlIHx8IFN0cmluZyhlcnJvcik7XHJcbiAgICAgIGNvbnN0IGlzUmF0ZUxpbWl0ID0gZXJyb3JNc2cuaW5jbHVkZXMoJzQyOScpIHx8IGVycm9yTXNnLmluY2x1ZGVzKCdyYXRlJykgfHwgZXJyb3JNc2cuaW5jbHVkZXMoJ3F1b3RhJyk7XHJcblxyXG4gICAgICB0aGlzLmxvZ2dlci5lcnJvcignY3JlYXRlVHJpZ2dlciBBUEkgY2FsbCBmYWlsZWQnLCB7XHJcbiAgICAgICAgdHJpZ2dlck5hbWU6IGNvbmZpZy5uYW1lLFxyXG4gICAgICAgIGVycm9yOiBlcnJvck1zZyxcclxuICAgICAgICBpc1JhdGVMaW1pdCxcclxuICAgICAgICBzdGFjazogZXJyb3I/LnN0YWNrXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBWYXJpYWJsZSBPcGVyYXRpb25zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIGFzeW5jIGdldFZhcmlhYmxlKHZhcmlhYmxlSWQ6IHN0cmluZyk6IFByb21pc2U8R1RNVmFyaWFibGUgfCBudWxsPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLm1jcENhbGwoJ2d0bV92YXJpYWJsZScsIHtcclxuICAgICAgICBhY3Rpb246ICdnZXQnLFxyXG4gICAgICAgIGFjY291bnRJZDogdGhpcy5jb250ZXh0LmFjY291bnRJZCxcclxuICAgICAgICBjb250YWluZXJJZDogdGhpcy5jb250ZXh0LmNvbnRhaW5lcklkLFxyXG4gICAgICAgIHdvcmtzcGFjZUlkOiB0aGlzLmNvbnRleHQud29ya3NwYWNlSWQsXHJcbiAgICAgICAgdmFyaWFibGVJZFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIGdldCDsnZHri7XsnYAgZGF0YSB3cmFwcGVyIOyXhuydtCDsp4HsoJEg67CY7ZmY65CoXHJcbiAgICAgIHJldHVybiByZXN1bHQ/LnZhcmlhYmxlSWQgPyByZXN1bHQgOiAocmVzdWx0Py5kYXRhIHx8IG51bGwpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgdGhpcy5sb2dnZXIud2FybihgRmFpbGVkIHRvIGdldCB2YXJpYWJsZSAke3ZhcmlhYmxlSWR9YCwgZXJyb3IpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGxpc3RWYXJpYWJsZXMob3B0aW9ucz86IE1DUENhbGxPcHRpb25zKTogUHJvbWlzZTxHVE1WYXJpYWJsZVtdPiB7XHJcbiAgICBjb25zdCBjYWNoZUtleSA9IGB2YXJpYWJsZXM6JHt0aGlzLmNvbnRleHQud29ya3NwYWNlSWR9YDtcclxuXHJcbiAgICBpZiAoIW9wdGlvbnM/LnJlZnJlc2gpIHtcclxuICAgICAgY29uc3QgY2FjaGVkID0gdGhpcy5nZXRGcm9tQ2FjaGU8R1RNVmFyaWFibGVbXT4oY2FjaGVLZXkpO1xyXG4gICAgICBpZiAoY2FjaGVkKSByZXR1cm4gY2FjaGVkO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGFsbFZhcmlhYmxlczogR1RNVmFyaWFibGVbXSA9IFtdO1xyXG4gICAgbGV0IHBhZ2UgPSAxO1xyXG4gICAgbGV0IGhhc01vcmUgPSB0cnVlO1xyXG5cclxuICAgIHdoaWxlIChoYXNNb3JlKSB7XHJcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubWNwQ2FsbCgnZ3RtX3ZhcmlhYmxlJywge1xyXG4gICAgICAgIGFjdGlvbjogJ2xpc3QnLFxyXG4gICAgICAgIGFjY291bnRJZDogdGhpcy5jb250ZXh0LmFjY291bnRJZCxcclxuICAgICAgICBjb250YWluZXJJZDogdGhpcy5jb250ZXh0LmNvbnRhaW5lcklkLFxyXG4gICAgICAgIHdvcmtzcGFjZUlkOiB0aGlzLmNvbnRleHQud29ya3NwYWNlSWQsXHJcbiAgICAgICAgcGFnZSxcclxuICAgICAgICBpdGVtc1BlclBhZ2U6IDIwLFxyXG4gICAgICAgIHJlZnJlc2g6IG9wdGlvbnM/LnJlZnJlc2hcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAocmVzdWx0Py5kYXRhKSB7XHJcbiAgICAgICAgYWxsVmFyaWFibGVzLnB1c2goLi4ucmVzdWx0LmRhdGEpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBoYXNNb3JlID0gcmVzdWx0Py5kYXRhPy5sZW5ndGggPT09IDIwO1xyXG4gICAgICBwYWdlKys7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5zZXRDYWNoZShjYWNoZUtleSwgYWxsVmFyaWFibGVzKTtcclxuICAgIHJldHVybiBhbGxWYXJpYWJsZXM7XHJcbiAgfVxyXG5cclxuICBhc3luYyBmaW5kVmFyaWFibGVCeU5hbWUobmFtZTogc3RyaW5nKTogUHJvbWlzZTxHVE1WYXJpYWJsZSB8IG51bGw+IHtcclxuICAgIGNvbnN0IHZhcmlhYmxlcyA9IGF3YWl0IHRoaXMubGlzdFZhcmlhYmxlcygpO1xyXG4gICAgcmV0dXJuIHZhcmlhYmxlcy5maW5kKHYgPT4gdi5uYW1lID09PSBuYW1lKSB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgY3JlYXRlVmFyaWFibGUoY29uZmlnOiBQYXJ0aWFsPEdUTVZhcmlhYmxlPik6IFByb21pc2U8R1RNVmFyaWFibGU+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubWNwQ2FsbCgnZ3RtX3ZhcmlhYmxlJywge1xyXG4gICAgICAgIGFjdGlvbjogJ2NyZWF0ZScsXHJcbiAgICAgICAgYWNjb3VudElkOiB0aGlzLmNvbnRleHQuYWNjb3VudElkLFxyXG4gICAgICAgIGNvbnRhaW5lcklkOiB0aGlzLmNvbnRleHQuY29udGFpbmVySWQsXHJcbiAgICAgICAgd29ya3NwYWNlSWQ6IHRoaXMuY29udGV4dC53b3Jrc3BhY2VJZCxcclxuICAgICAgICBjcmVhdGVPclVwZGF0ZUNvbmZpZzogY29uZmlnXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gY3JlYXRlIOydkeuLteydgCBkYXRhIHdyYXBwZXIg7JeG7J20IOyngeygkSDrsJjtmZjrkKhcclxuICAgICAgY29uc3QgdmFyaWFibGVEYXRhID0gcmVzdWx0Py52YXJpYWJsZUlkID8gcmVzdWx0IDogcmVzdWx0Py5kYXRhO1xyXG5cclxuICAgICAgaWYgKCF2YXJpYWJsZURhdGE/LnZhcmlhYmxlSWQpIHtcclxuICAgICAgICBjb25zdCBlcnJvck1zZyA9IHJlc3VsdD8uZXJyb3IgfHwgJ05vIGRhdGEgcmV0dXJuZWQnO1xyXG4gICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdjcmVhdGVWYXJpYWJsZSBmYWlsZWQgLSBubyBkYXRhJywge1xyXG4gICAgICAgICAgY29uZmlnOiB7IG5hbWU6IGNvbmZpZy5uYW1lLCB0eXBlOiBjb25maWcudHlwZSB9LFxyXG4gICAgICAgICAgZXJyb3I6IGVycm9yTXNnLFxyXG4gICAgICAgICAgZnVsbFJlc3VsdDogcmVzdWx0XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhyb3cgbmV3IE1DUEFwaUVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIHZhcmlhYmxlOiAke2Vycm9yTXNnfWAsIHsgY29uZmlnIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLmxvZ2dlci5pbmZvKCdWYXJpYWJsZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseScsIHtcclxuICAgICAgICB2YXJpYWJsZUlkOiB2YXJpYWJsZURhdGEudmFyaWFibGVJZCxcclxuICAgICAgICBuYW1lOiB2YXJpYWJsZURhdGEubmFtZVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHRoaXMuaW52YWxpZGF0ZUNhY2hlKGB2YXJpYWJsZXM6JHt0aGlzLmNvbnRleHQud29ya3NwYWNlSWR9YCk7XHJcbiAgICAgIHJldHVybiB2YXJpYWJsZURhdGE7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3I/Lm1lc3NhZ2UgfHwgU3RyaW5nKGVycm9yKTtcclxuICAgICAgY29uc3QgaXNSYXRlTGltaXQgPSBlcnJvck1zZy5pbmNsdWRlcygnNDI5JykgfHwgZXJyb3JNc2cuaW5jbHVkZXMoJ3JhdGUnKSB8fCBlcnJvck1zZy5pbmNsdWRlcygncXVvdGEnKTtcclxuXHJcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdjcmVhdGVWYXJpYWJsZSBBUEkgY2FsbCBmYWlsZWQnLCB7XHJcbiAgICAgICAgdmFyaWFibGVOYW1lOiBjb25maWcubmFtZSxcclxuICAgICAgICBlcnJvcjogZXJyb3JNc2csXHJcbiAgICAgICAgaXNSYXRlTGltaXQsXHJcbiAgICAgICAgc3RhY2s6IGVycm9yPy5zdGFja1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gVGVtcGxhdGUgT3BlcmF0aW9ucyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICBhc3luYyBnZXRUZW1wbGF0ZSh0ZW1wbGF0ZUlkOiBzdHJpbmcpOiBQcm9taXNlPEdUTVRlbXBsYXRlIHwgbnVsbD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5tY3BDYWxsKCdndG1fdGVtcGxhdGUnLCB7XHJcbiAgICAgICAgYWN0aW9uOiAnZ2V0JyxcclxuICAgICAgICBhY2NvdW50SWQ6IHRoaXMuY29udGV4dC5hY2NvdW50SWQsXHJcbiAgICAgICAgY29udGFpbmVySWQ6IHRoaXMuY29udGV4dC5jb250YWluZXJJZCxcclxuICAgICAgICB3b3Jrc3BhY2VJZDogdGhpcy5jb250ZXh0LndvcmtzcGFjZUlkLFxyXG4gICAgICAgIHRlbXBsYXRlSWRcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBnZXQg7J2R64u17J2AIGRhdGEgd3JhcHBlciDsl4bsnbQg7KeB7KCRIOuwmO2ZmOuQqFxyXG4gICAgICByZXR1cm4gcmVzdWx0Py50ZW1wbGF0ZUlkID8gcmVzdWx0IDogKHJlc3VsdD8uZGF0YSB8fCBudWxsKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oYEZhaWxlZCB0byBnZXQgdGVtcGxhdGUgJHt0ZW1wbGF0ZUlkfWAsIGVycm9yKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBsaXN0VGVtcGxhdGVzKG9wdGlvbnM/OiBNQ1BDYWxsT3B0aW9ucyk6IFByb21pc2U8R1RNVGVtcGxhdGVbXT4ge1xyXG4gICAgY29uc3QgY2FjaGVLZXkgPSBgdGVtcGxhdGVzOiR7dGhpcy5jb250ZXh0LndvcmtzcGFjZUlkfWA7XHJcblxyXG4gICAgaWYgKCFvcHRpb25zPy5yZWZyZXNoKSB7XHJcbiAgICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuZ2V0RnJvbUNhY2hlPEdUTVRlbXBsYXRlW10+KGNhY2hlS2V5KTtcclxuICAgICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBhbGxUZW1wbGF0ZXM6IEdUTVRlbXBsYXRlW10gPSBbXTtcclxuICAgIGxldCBwYWdlID0gMTtcclxuICAgIGxldCBoYXNNb3JlID0gdHJ1ZTtcclxuXHJcbiAgICB3aGlsZSAoaGFzTW9yZSkge1xyXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLm1jcENhbGwoJ2d0bV90ZW1wbGF0ZScsIHtcclxuICAgICAgICBhY3Rpb246ICdsaXN0JyxcclxuICAgICAgICBhY2NvdW50SWQ6IHRoaXMuY29udGV4dC5hY2NvdW50SWQsXHJcbiAgICAgICAgY29udGFpbmVySWQ6IHRoaXMuY29udGV4dC5jb250YWluZXJJZCxcclxuICAgICAgICB3b3Jrc3BhY2VJZDogdGhpcy5jb250ZXh0LndvcmtzcGFjZUlkLFxyXG4gICAgICAgIHBhZ2UsXHJcbiAgICAgICAgaXRlbXNQZXJQYWdlOiAyMFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmIChyZXN1bHQ/LmRhdGEpIHtcclxuICAgICAgICBhbGxUZW1wbGF0ZXMucHVzaCguLi5yZXN1bHQuZGF0YSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGhhc01vcmUgPSByZXN1bHQ/LmRhdGE/Lmxlbmd0aCA9PT0gMjA7XHJcbiAgICAgIHBhZ2UrKztcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnNldENhY2hlKGNhY2hlS2V5LCBhbGxUZW1wbGF0ZXMpO1xyXG4gICAgcmV0dXJuIGFsbFRlbXBsYXRlcztcclxuICB9XHJcblxyXG4gIGFzeW5jIGZpbmRUZW1wbGF0ZUJ5TmFtZShuYW1lOiBzdHJpbmcpOiBQcm9taXNlPEdUTVRlbXBsYXRlIHwgbnVsbD4ge1xyXG4gICAgY29uc3QgdGVtcGxhdGVzID0gYXdhaXQgdGhpcy5saXN0VGVtcGxhdGVzKCk7XHJcbiAgICByZXR1cm4gdGVtcGxhdGVzLmZpbmQodCA9PiB0Lm5hbWUgPT09IG5hbWUpIHx8IG51bGw7XHJcbiAgfVxyXG5cclxuICBhc3luYyBjcmVhdGVUZW1wbGF0ZShjb25maWc6IFBhcnRpYWw8R1RNVGVtcGxhdGU+KTogUHJvbWlzZTxHVE1UZW1wbGF0ZT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5tY3BDYWxsKCdndG1fdGVtcGxhdGUnLCB7XHJcbiAgICAgICAgYWN0aW9uOiAnY3JlYXRlJyxcclxuICAgICAgICBhY2NvdW50SWQ6IHRoaXMuY29udGV4dC5hY2NvdW50SWQsXHJcbiAgICAgICAgY29udGFpbmVySWQ6IHRoaXMuY29udGV4dC5jb250YWluZXJJZCxcclxuICAgICAgICB3b3Jrc3BhY2VJZDogdGhpcy5jb250ZXh0LndvcmtzcGFjZUlkLFxyXG4gICAgICAgIGNyZWF0ZU9yVXBkYXRlQ29uZmlnOiBjb25maWdcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBjcmVhdGUg7J2R64u17J2AIGRhdGEgd3JhcHBlciDsl4bsnbQg7KeB7KCRIOuwmO2ZmOuQqFxyXG4gICAgICBjb25zdCB0ZW1wbGF0ZURhdGEgPSByZXN1bHQ/LnRlbXBsYXRlSWQgPyByZXN1bHQgOiByZXN1bHQ/LmRhdGE7XHJcblxyXG4gICAgICBpZiAoIXRlbXBsYXRlRGF0YT8udGVtcGxhdGVJZCkge1xyXG4gICAgICAgIGNvbnN0IGVycm9yTXNnID0gcmVzdWx0Py5lcnJvciB8fCAnTm8gZGF0YSByZXR1cm5lZCc7XHJcbiAgICAgICAgdGhpcy5sb2dnZXIuZXJyb3IoJ2NyZWF0ZVRlbXBsYXRlIGZhaWxlZCAtIG5vIGRhdGEnLCB7XHJcbiAgICAgICAgICBjb25maWc6IHsgbmFtZTogY29uZmlnLm5hbWUgfSxcclxuICAgICAgICAgIGVycm9yOiBlcnJvck1zZyxcclxuICAgICAgICAgIGZ1bGxSZXN1bHQ6IHJlc3VsdFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRocm93IG5ldyBNQ1BBcGlFcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSB0ZW1wbGF0ZTogJHtlcnJvck1zZ31gLCB7IGNvbmZpZyB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy5sb2dnZXIuaW5mbygnVGVtcGxhdGUgY3JlYXRlZCBzdWNjZXNzZnVsbHknLCB7XHJcbiAgICAgICAgdGVtcGxhdGVJZDogdGVtcGxhdGVEYXRhLnRlbXBsYXRlSWQsXHJcbiAgICAgICAgbmFtZTogdGVtcGxhdGVEYXRhLm5hbWVcclxuICAgICAgfSk7XHJcblxyXG4gICAgICB0aGlzLmludmFsaWRhdGVDYWNoZShgdGVtcGxhdGVzOiR7dGhpcy5jb250ZXh0LndvcmtzcGFjZUlkfWApO1xyXG4gICAgICByZXR1cm4gdGVtcGxhdGVEYXRhO1xyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICBjb25zdCBlcnJvck1zZyA9IGVycm9yPy5tZXNzYWdlIHx8IFN0cmluZyhlcnJvcik7XHJcbiAgICAgIGNvbnN0IGlzUmF0ZUxpbWl0ID0gZXJyb3JNc2cuaW5jbHVkZXMoJzQyOScpIHx8IGVycm9yTXNnLmluY2x1ZGVzKCdyYXRlJykgfHwgZXJyb3JNc2cuaW5jbHVkZXMoJ3F1b3RhJyk7XHJcblxyXG4gICAgICB0aGlzLmxvZ2dlci5lcnJvcignY3JlYXRlVGVtcGxhdGUgQVBJIGNhbGwgZmFpbGVkJywge1xyXG4gICAgICAgIHRlbXBsYXRlTmFtZTogY29uZmlnLm5hbWUsXHJcbiAgICAgICAgZXJyb3I6IGVycm9yTXNnLFxyXG4gICAgICAgIGlzUmF0ZUxpbWl0LFxyXG4gICAgICAgIHN0YWNrOiBlcnJvcj8uc3RhY2tcclxuICAgICAgfSk7XHJcblxyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGFzeW5jIGRlbGV0ZVRlbXBsYXRlKHRlbXBsYXRlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5tY3BDYWxsKCdndG1fdGVtcGxhdGUnLCB7XHJcbiAgICAgIGFjdGlvbjogJ3JlbW92ZScsXHJcbiAgICAgIGFjY291bnRJZDogdGhpcy5jb250ZXh0LmFjY291bnRJZCxcclxuICAgICAgY29udGFpbmVySWQ6IHRoaXMuY29udGV4dC5jb250YWluZXJJZCxcclxuICAgICAgd29ya3NwYWNlSWQ6IHRoaXMuY29udGV4dC53b3Jrc3BhY2VJZCxcclxuICAgICAgdGVtcGxhdGVJZFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5pbnZhbGlkYXRlQ2FjaGUoYHRlbXBsYXRlczoke3RoaXMuY29udGV4dC53b3Jrc3BhY2VJZH1gKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IERlbGV0ZSBPcGVyYXRpb25zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIGFzeW5jIGRlbGV0ZVRhZyh0YWdJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLm1jcENhbGwoJ2d0bV90YWcnLCB7XHJcbiAgICAgIGFjdGlvbjogJ3JlbW92ZScsXHJcbiAgICAgIGFjY291bnRJZDogdGhpcy5jb250ZXh0LmFjY291bnRJZCxcclxuICAgICAgY29udGFpbmVySWQ6IHRoaXMuY29udGV4dC5jb250YWluZXJJZCxcclxuICAgICAgd29ya3NwYWNlSWQ6IHRoaXMuY29udGV4dC53b3Jrc3BhY2VJZCxcclxuICAgICAgdGFnSWRcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuaW52YWxpZGF0ZUNhY2hlKGB0YWdzOiR7dGhpcy5jb250ZXh0LndvcmtzcGFjZUlkfWApO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgZGVsZXRlVHJpZ2dlcih0cmlnZ2VySWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5tY3BDYWxsKCdndG1fdHJpZ2dlcicsIHtcclxuICAgICAgYWN0aW9uOiAncmVtb3ZlJyxcclxuICAgICAgYWNjb3VudElkOiB0aGlzLmNvbnRleHQuYWNjb3VudElkLFxyXG4gICAgICBjb250YWluZXJJZDogdGhpcy5jb250ZXh0LmNvbnRhaW5lcklkLFxyXG4gICAgICB3b3Jrc3BhY2VJZDogdGhpcy5jb250ZXh0LndvcmtzcGFjZUlkLFxyXG4gICAgICB0cmlnZ2VySWRcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuaW52YWxpZGF0ZUNhY2hlKGB0cmlnZ2Vyczoke3RoaXMuY29udGV4dC53b3Jrc3BhY2VJZH1gKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGRlbGV0ZVZhcmlhYmxlKHZhcmlhYmxlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5tY3BDYWxsKCdndG1fdmFyaWFibGUnLCB7XHJcbiAgICAgIGFjdGlvbjogJ3JlbW92ZScsXHJcbiAgICAgIGFjY291bnRJZDogdGhpcy5jb250ZXh0LmFjY291bnRJZCxcclxuICAgICAgY29udGFpbmVySWQ6IHRoaXMuY29udGV4dC5jb250YWluZXJJZCxcclxuICAgICAgd29ya3NwYWNlSWQ6IHRoaXMuY29udGV4dC53b3Jrc3BhY2VJZCxcclxuICAgICAgdmFyaWFibGVJZFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5pbnZhbGlkYXRlQ2FjaGUoYHZhcmlhYmxlczoke3RoaXMuY29udGV4dC53b3Jrc3BhY2VJZH1gKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IENhY2hlIE1hbmFnZW1lbnQgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgcHJpdmF0ZSBnZXRGcm9tQ2FjaGU8VD4oa2V5OiBzdHJpbmcpOiBUIHwgbnVsbCB7XHJcbiAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmNhY2hlLmdldChrZXkpO1xyXG4gICAgaWYgKGNhY2hlZCAmJiBEYXRlLm5vdygpIC0gY2FjaGVkLnRpbWVzdGFtcCA8IHRoaXMuY2FjaGVUVEwpIHtcclxuICAgICAgcmV0dXJuIGNhY2hlZC5kYXRhIGFzIFQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2V0Q2FjaGUoa2V5OiBzdHJpbmcsIGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgdGhpcy5jYWNoZS5zZXQoa2V5LCB7IGRhdGEsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW52YWxpZGF0ZUNhY2hlKGtleTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmNhY2hlLmRlbGV0ZShrZXkpO1xyXG4gIH1cclxuXHJcbiAgY2xlYXJDYWNoZSgpOiB2b2lkIHtcclxuICAgIHRoaXMuY2FjaGUuY2xlYXIoKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IENvbnRleHQgTWFuYWdlbWVudCA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICB1cGRhdGVDb250ZXh0KGNvbnRleHQ6IFBhcnRpYWw8V29ya3NwYWNlQ29udGV4dD4pOiB2b2lkIHtcclxuICAgIE9iamVjdC5hc3NpZ24odGhpcy5jb250ZXh0LCBjb250ZXh0KTtcclxuICAgIHRoaXMuY2xlYXJDYWNoZSgpO1xyXG4gIH1cclxuXHJcbiAgZ2V0Q29udGV4dCgpOiBXb3Jrc3BhY2VDb250ZXh0IHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuY29udGV4dCB9O1xyXG4gIH1cclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT0gRmFjdG9yeSBGdW5jdGlvbiA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1DUEFkYXB0ZXIoXHJcbiAgbWNwQ2FsbDogTUNQQ2FsbEZuLFxyXG4gIGNvbnRleHQ6IFdvcmtzcGFjZUNvbnRleHQsXHJcbiAgb3B0aW9ucz86IHsgbG9nZ2VyPzogTG9nZ2VyOyBjYWNoZVRUTD86IG51bWJlciB9XHJcbik6IEdUTU1DUEFkYXB0ZXJJbXBsIHtcclxuICByZXR1cm4gbmV3IEdUTU1DUEFkYXB0ZXJJbXBsKG1jcENhbGwsIGNvbnRleHQsIG9wdGlvbnMpO1xyXG59XHJcbiJdfQ==