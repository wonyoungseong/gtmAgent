/**
 * gtm_workspace Tool Schema
 * GTM Workspace 관리
 */

import { ToolSchema, PAGE_SIZES } from "../types.js";

export const gtmWorkspaceSchema: ToolSchema = {
  name: "gtm_workspace",
  description: `Performs various workspace operations including create, get, list, update, remove, createVersion, getStatus, sync, quickPreview, and resolveConflict actions. The 'list' action returns up to ${PAGE_SIZES.DEFAULT} items per page.`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "get", "list", "update", "remove", "createVersion", "getStatus", "sync", "quickPreview", "resolveConflict"],
        description: "The workspace operation to perform.",
      },
      accountId: {
        type: "string",
        description: "The unique ID of the GTM Account containing the workspace.",
      },
      containerId: {
        type: "string",
        description: "The unique ID of the GTM Container containing the workspace.",
      },
      workspaceId: {
        type: "string",
        description: "The unique ID of the GTM Workspace. Required for all actions except 'create' and 'list'.",
      },
      createOrUpdateConfig: {
        type: "object",
        description: "Configuration for 'create' and 'update' actions.",
      },
      fingerprint: {
        type: "string",
        description: "Fingerprint for optimistic concurrency control. Required for 'update' and 'resolveConflict' actions.",
      },
      entity: {
        type: "object",
        description: "The resolved entity for 'resolveConflict' action.",
      },
      changeStatus: {
        type: "string",
        description: "The status of the change for 'resolveConflict' action. Possible values: 'added', 'modified', 'deleted', 'unmodified'.",
      },
      page: {
        type: "number",
        default: 1,
      },
      itemsPerPage: {
        type: "number",
        default: PAGE_SIZES.DEFAULT,
      },
    },
    required: ["action", "accountId", "containerId"],
  },
};
