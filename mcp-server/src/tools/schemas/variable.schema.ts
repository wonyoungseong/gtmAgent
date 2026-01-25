/**
 * gtm_variable Tool Schema
 * GTM Variable 관리
 */

import { ToolSchema, PAGE_SIZES } from "../types.js";

export const gtmVariableSchema: ToolSchema = {
  name: "gtm_variable",
  description: `Performs all GTM variable operations: create, get, list, update, remove, revert. The 'list' action returns up to ${PAGE_SIZES.VARIABLE} items per page.`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "get", "list", "update", "remove", "revert"],
        description: "The GTM variable operation to perform.",
      },
      accountId: {
        type: "string",
        description: "The unique ID of the GTM Account containing the variable.",
      },
      containerId: {
        type: "string",
        description: "The unique ID of the GTM Container containing the variable.",
      },
      workspaceId: {
        type: "string",
        description: "The unique ID of the GTM Workspace containing the variable.",
      },
      variableId: {
        type: "string",
        description: "The unique ID of the GTM variable. Required for 'get', 'update', 'remove', and 'revert' actions.",
      },
      createOrUpdateConfig: {
        type: "object",
        description: "Configuration for 'create' and 'update' actions.",
      },
      fingerprint: {
        type: "string",
        description: "The fingerprint for optimistic concurrency control.",
      },
      page: {
        type: "number",
        default: 1,
      },
      itemsPerPage: {
        type: "number",
        default: PAGE_SIZES.VARIABLE,
        maximum: PAGE_SIZES.VARIABLE,
      },
      refresh: {
        type: "boolean",
        default: false,
        description: "Force refresh cache by fetching latest data from API, ignoring cached data.",
      },
    },
    required: ["action", "accountId", "containerId", "workspaceId"],
  },
};
