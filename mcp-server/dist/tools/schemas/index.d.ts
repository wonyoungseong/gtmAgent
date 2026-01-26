/**
 * Tool Schemas Index
 * 모든 GTM Tool Schema를 통합 export
 */
import { ToolSchema } from "../types.js";
export { createEntitySchema, type EntitySchemaConfig, type HierarchyLevel } from "./schema-builder.js";
import { gtmContextSchema } from "./context.schema.js";
import { gtmAccountSchema } from "./account.schema.js";
import { gtmContainerSchema } from "./container.schema.js";
import { gtmWorkspaceSchema } from "./workspace.schema.js";
import { gtmTagSchema } from "./tag.schema.js";
import { gtmTriggerSchema } from "./trigger.schema.js";
import { gtmVariableSchema } from "./variable.schema.js";
import { gtmVersionSchema, gtmBuiltInVariableSchema, gtmClientSchema, gtmDestinationSchema, gtmEnvironmentSchema, gtmFolderSchema, gtmGtagConfigSchema, gtmTemplateSchema, gtmTransformationSchema, gtmUserPermissionSchema, gtmVersionHeaderSchema, gtmZoneSchema, gtmExportFullSchema, gtmRemoveSessionSchema, gtmCacheSchema } from "./other.schema.js";
import { gtmWorkflowSchema } from "./workflow.schema.js";
export declare const allSchemas: ToolSchema[];
export { gtmContextSchema, gtmAccountSchema, gtmContainerSchema, gtmWorkspaceSchema, gtmTagSchema, gtmTriggerSchema, gtmVariableSchema, gtmVersionSchema, gtmBuiltInVariableSchema, gtmClientSchema, gtmDestinationSchema, gtmEnvironmentSchema, gtmFolderSchema, gtmGtagConfigSchema, gtmTemplateSchema, gtmTransformationSchema, gtmUserPermissionSchema, gtmVersionHeaderSchema, gtmZoneSchema, gtmExportFullSchema, gtmRemoveSessionSchema, gtmCacheSchema, gtmWorkflowSchema, };
