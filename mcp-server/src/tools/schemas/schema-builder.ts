/**
 * Schema Builder Pattern
 * 공통 필드와 패턴을 재사용하여 스키마 생성
 */

import { ToolSchema, ToolSchemaProperty, PAGE_SIZES } from "../types.js";

// ==================== Types ====================

export type HierarchyLevel = "account" | "container" | "workspace";

export interface EntitySchemaConfig {
  name: string;
  entityName: string;
  description: string;
  hierarchy: HierarchyLevel;
  idField?: string;
  idDescription?: string;
  actions: string[];
  pageSize?: number;
  extraFields?: Record<string, ToolSchemaProperty>;
  extraRequired?: string[];
  includeCrudFields?: boolean;
}

// ==================== Field Builders ====================

/**
 * 계층별 필수 ID 필드 생성
 */
function createHierarchyFields(
  level: HierarchyLevel,
  entityName: string
): Record<string, ToolSchemaProperty> {
  const fields: Record<string, ToolSchemaProperty> = {
    accountId: {
      type: "string",
      description: `The unique ID of the GTM Account containing the ${entityName}.`,
    },
  };

  if (level === "container" || level === "workspace") {
    fields.containerId = {
      type: "string",
      description: `The unique ID of the GTM Container containing the ${entityName}.`,
    };
  }

  if (level === "workspace") {
    fields.workspaceId = {
      type: "string",
      description: `The unique ID of the GTM Workspace containing the ${entityName}.`,
    };
  }

  return fields;
}

/**
 * 계층별 필수 필드 목록
 */
function getRequiredHierarchyFields(level: HierarchyLevel): string[] {
  switch (level) {
    case "account":
      return ["accountId"];
    case "container":
      return ["accountId", "containerId"];
    case "workspace":
      return ["accountId", "containerId", "workspaceId"];
  }
}

/**
 * 페이지네이션 필드 생성
 */
function createPaginationFields(
  pageSize: number
): Record<string, ToolSchemaProperty> {
  return {
    page: {
      type: "number",
      default: 1,
    },
    itemsPerPage: {
      type: "number",
      default: pageSize,
      maximum: pageSize,
    },
  };
}

/**
 * CRUD 공통 필드 생성
 */
function createCrudFields(): Record<string, ToolSchemaProperty> {
  return {
    createOrUpdateConfig: {
      type: "object",
      description: "Configuration for 'create' and 'update' actions.",
    },
    fingerprint: {
      type: "string",
      description: "The fingerprint for optimistic concurrency control.",
    },
  };
}

// ==================== Schema Factory ====================

/**
 * 엔티티 스키마 생성 팩토리
 */
export function createEntitySchema(config: EntitySchemaConfig): ToolSchema {
  const {
    name,
    entityName,
    description,
    hierarchy,
    idField,
    idDescription,
    actions,
    pageSize = PAGE_SIZES.DEFAULT,
    extraFields = {},
    extraRequired = [],
    includeCrudFields = true,
  } = config;

  // 기본 properties 조합
  const properties: Record<string, ToolSchemaProperty> = {
    action: {
      type: "string",
      enum: actions,
      description: `The ${entityName} operation to perform.`,
    },
    ...createHierarchyFields(hierarchy, entityName),
  };

  // ID 필드 추가
  if (idField) {
    properties[idField] = {
      type: "string",
      description:
        idDescription ||
        `The unique ID of the GTM ${entityName}. Required for 'get', 'update', 'remove', and 'revert' actions.`,
    };
  }

  // CRUD 필드 추가
  if (includeCrudFields) {
    Object.assign(properties, createCrudFields());
  }

  // 페이지네이션 필드 추가
  Object.assign(properties, createPaginationFields(pageSize));

  // 추가 필드 병합
  Object.assign(properties, extraFields);

  // 필수 필드 조합
  const required = ["action", ...getRequiredHierarchyFields(hierarchy), ...extraRequired];

  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      required,
    },
  };
}

// ==================== Exports ====================

export { PAGE_SIZES };
