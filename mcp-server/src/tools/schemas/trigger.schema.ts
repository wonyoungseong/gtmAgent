/**
 * gtm_trigger Tool Schema
 * GTM Trigger 관리
 */

import { ToolSchema, PAGE_SIZES } from "../types.js";

export const gtmTriggerSchema: ToolSchema = {
  name: "gtm_trigger",
  description: `Performs all GTM trigger operations: create, get, list, update, remove, revert. The 'list' action returns up to ${PAGE_SIZES.TRIGGER} items per page.`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "get", "list", "update", "remove", "revert"],
        description: "The GTM trigger operation to perform.",
      },
      accountId: {
        type: "string",
        description: "The unique ID of the GTM Account containing the trigger.",
      },
      containerId: {
        type: "string",
        description: "The unique ID of the GTM Container containing the trigger.",
      },
      workspaceId: {
        type: "string",
        description: "The unique ID of the GTM Workspace containing the trigger.",
      },
      triggerId: {
        type: "string",
        description: "The unique ID of the GTM trigger. Required for 'get', 'update', 'remove', and 'revert' actions.",
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
        default: PAGE_SIZES.TRIGGER,
        maximum: PAGE_SIZES.TRIGGER,
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
