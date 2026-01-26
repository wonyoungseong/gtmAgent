/**
 * MCP Adapter
 *
 * GTM MCP Server와의 통신을 추상화하는 어댑터
 * Skills의 GTMMCPAdapter 인터페이스를 구현합니다.
 */
import { GTMMCPAdapter, GTMTag, GTMTrigger, GTMVariable, GTMTemplate } from 'gtm-agent-skills';
import { WorkspaceContext } from '../types/agent';
import { Logger } from '../utils/logger';
export interface MCPCallOptions {
    timeout?: number;
    refresh?: boolean;
}
export type MCPCallFn = (toolName: string, args: Record<string, any>) => Promise<any>;
export declare class GTMMCPAdapterImpl implements GTMMCPAdapter {
    private mcpCall;
    private context;
    private logger;
    private cache;
    private cacheTTL;
    constructor(mcpCall: MCPCallFn, context: WorkspaceContext, options?: {
        logger?: Logger;
        cacheTTL?: number;
    });
    getTag(tagId: string): Promise<GTMTag | null>;
    listTags(options?: MCPCallOptions): Promise<GTMTag[]>;
    findTagByName(name: string): Promise<GTMTag | null>;
    createTag(config: Partial<GTMTag>): Promise<GTMTag>;
    getTrigger(triggerId: string): Promise<GTMTrigger | null>;
    listTriggers(options?: MCPCallOptions): Promise<GTMTrigger[]>;
    findTriggerByName(name: string): Promise<GTMTrigger | null>;
    createTrigger(config: Partial<GTMTrigger>): Promise<GTMTrigger>;
    getVariable(variableId: string): Promise<GTMVariable | null>;
    listVariables(options?: MCPCallOptions): Promise<GTMVariable[]>;
    findVariableByName(name: string): Promise<GTMVariable | null>;
    createVariable(config: Partial<GTMVariable>): Promise<GTMVariable>;
    getTemplate(templateId: string): Promise<GTMTemplate | null>;
    listTemplates(options?: MCPCallOptions): Promise<GTMTemplate[]>;
    findTemplateByName(name: string): Promise<GTMTemplate | null>;
    createTemplate(config: Partial<GTMTemplate>): Promise<GTMTemplate>;
    deleteTemplate(templateId: string): Promise<void>;
    deleteTag(tagId: string): Promise<void>;
    deleteTrigger(triggerId: string): Promise<void>;
    deleteVariable(variableId: string): Promise<void>;
    private getFromCache;
    private setCache;
    private invalidateCache;
    clearCache(): void;
    updateContext(context: Partial<WorkspaceContext>): void;
    getContext(): WorkspaceContext;
}
export declare function createMCPAdapter(mcpCall: MCPCallFn, context: WorkspaceContext, options?: {
    logger?: Logger;
    cacheTTL?: number;
}): GTMMCPAdapterImpl;
