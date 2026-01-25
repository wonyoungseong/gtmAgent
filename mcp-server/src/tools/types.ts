/**
 * Common Types for GTM MCP Tools
 */

import { tagmanager_v2 } from "googleapis";

// ==================== Tool Result Types ====================

export interface ToolResultContent {
  type: "text";
  text: string;
}

export interface ToolResult {
  content: ToolResultContent[];
}

// ==================== Tool Handler Type ====================

export type ToolHandler = (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
) => Promise<ToolResult>;

// ==================== Tool Schema Types ====================

export interface ToolSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  maximum?: number;
  items?: { type: string };
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

// ==================== Helper Functions ====================

export const createTextResult = (data: unknown): ToolResult => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(data, null, 2),
    },
  ],
});

export const createErrorResult = (message: string, error?: unknown): ToolResult => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(
        {
          error: message,
          details: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      ),
    },
  ],
});

// ==================== Pagination Helper ====================

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

export const paginateArray = <T>(
  arr: T[],
  page: number,
  itemsPerPage: number
): PaginatedResult<T> => {
  const totalItems = arr.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const data = arr.slice(startIndex, endIndex);

  return {
    data,
    pagination: {
      page,
      itemsPerPage,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

// ==================== Page Size Constants ====================

export const PAGE_SIZES = {
  TAG: 20,
  TRIGGER: 20,
  VARIABLE: 20,
  TEMPLATE: 20,
  ZONE: 20,
  VERSION: 20,
  DEFAULT: 50,
} as const;
