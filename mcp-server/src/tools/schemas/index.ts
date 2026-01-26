/**
 * Tool Schemas Index
 * 모든 GTM Tool Schema를 통합 export
 */

import { ToolSchema } from "../types.js";

// Schema builder utilities
export { createEntitySchema, type EntitySchemaConfig, type HierarchyLevel } from "./schema-builder.js";

// Core schemas
import { gtmContextSchema } from "./context.schema.js";
import { gtmAccountSchema } from "./account.schema.js";
import { gtmContainerSchema } from "./container.schema.js";
import { gtmWorkspaceSchema } from "./workspace.schema.js";

// Entity schemas
import { gtmTagSchema } from "./tag.schema.js";
import { gtmTriggerSchema } from "./trigger.schema.js";
import { gtmVariableSchema } from "./variable.schema.js";

// Other schemas
import {
  gtmVersionSchema,
  gtmBuiltInVariableSchema,
  gtmClientSchema,
  gtmDestinationSchema,
  gtmEnvironmentSchema,
  gtmFolderSchema,
  gtmGtagConfigSchema,
  gtmTemplateSchema,
  gtmTransformationSchema,
  gtmUserPermissionSchema,
  gtmVersionHeaderSchema,
  gtmZoneSchema,
  gtmExportFullSchema,
  gtmRemoveSessionSchema,
  gtmCacheSchema,
} from "./other.schema.js";
import { gtmWorkflowSchema } from "./workflow.schema.js";

// ==================== All Schemas ====================

export const allSchemas: ToolSchema[] = [
  gtmContextSchema,
  gtmAccountSchema,
  gtmContainerSchema,
  gtmWorkspaceSchema,
  gtmTagSchema,
  gtmTriggerSchema,
  gtmVariableSchema,
  gtmVersionSchema,
  gtmVersionHeaderSchema,
  gtmBuiltInVariableSchema,
  gtmClientSchema,
  gtmDestinationSchema,
  gtmEnvironmentSchema,
  gtmFolderSchema,
  gtmGtagConfigSchema,
  gtmTemplateSchema,
  gtmTransformationSchema,
  gtmUserPermissionSchema,
  gtmZoneSchema,
  gtmExportFullSchema,
  gtmRemoveSessionSchema,
  gtmCacheSchema,
  gtmWorkflowSchema,
];

export {
  gtmContextSchema,
  gtmAccountSchema,
  gtmContainerSchema,
  gtmWorkspaceSchema,
  gtmTagSchema,
  gtmTriggerSchema,
  gtmVariableSchema,
  gtmVersionSchema,
  gtmBuiltInVariableSchema,
  gtmClientSchema,
  gtmDestinationSchema,
  gtmEnvironmentSchema,
  gtmFolderSchema,
  gtmGtagConfigSchema,
  gtmTemplateSchema,
  gtmTransformationSchema,
  gtmUserPermissionSchema,
  gtmVersionHeaderSchema,
  gtmZoneSchema,
  gtmExportFullSchema,
  gtmRemoveSessionSchema,
  gtmCacheSchema,
  gtmWorkflowSchema,
};
