/**
 * Common Types for GTM MCP Tools
 */
import { tagmanager_v2 } from "googleapis";
export interface ToolResultContent {
    type: "text";
    text: string;
}
export interface ToolResult {
    content: ToolResultContent[];
}
export type ToolHandler = (tagmanager: tagmanager_v2.Tagmanager, args: Record<string, unknown>) => Promise<ToolResult>;
export interface ToolSchemaProperty {
    type: string;
    description?: string;
    enum?: string[];
    default?: unknown;
    maximum?: number;
    items?: {
        type: string;
    };
}
export interface ToolSchema {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, ToolSchemaProperty>;
        required: string[];
    };
}
export declare const createTextResult: (data: unknown) => ToolResult;
export declare const createErrorResult: (message: string, error?: unknown) => ToolResult;
export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        itemsPerPage: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}
export declare const paginateArray: <T>(arr: T[], page: number, itemsPerPage: number) => PaginatedResult<T>;
export declare const PAGE_SIZES: {
    readonly TAG: 20;
    readonly TRIGGER: 20;
    readonly VARIABLE: 20;
    readonly TEMPLATE: 20;
    readonly ZONE: 20;
    readonly VERSION: 20;
    readonly DEFAULT: 50;
};
