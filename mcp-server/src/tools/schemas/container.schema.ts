/**
 * gtm_container Tool Schema
 * GTM Container 관리
 */

import { ToolSchema, PAGE_SIZES } from "../types.js";

export const gtmContainerSchema: ToolSchema = {
  name: "gtm_container",
  description: `Performs container-related operations: get, list, combine, lookup, moveTagId, snippet. The 'list' action returns up to itemsPerPage items per page. NOTE: create/update/remove actions are disabled for safety.`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get", "list", "combine", "lookup", "moveTagId", "snippet"],
        description: "The container operation to perform. Must be one of: 'get', 'list', 'combine', 'lookup', 'moveTagId', 'snippet'. NOTE: create/update/remove are disabled for safety.",
      },
      accountId: {
        type: "string",
        description: "The unique ID of the GTM Account containing the container.",
      },
      containerId: {
        type: "string",
        description: "The unique ID of the GTM Container. Required for 'get', 'update', 'remove', 'combine', 'lookup', 'moveTagId', and 'snippet' actions.",
      },
      destinationId: {
        type: "string",
        description: "The destination ID linked to a GTM Container (e.g., AW-123456789). Required for the 'lookup' action.",
      },
      createOrUpdateConfig: {
        type: "object",
        description: "Configuration for 'create' and 'update' actions. All fields correspond to the GTM Container resource.",
      },
      fingerprint: {
        type: "string",
        description: "The fingerprint for optimistic concurrency control. Required for 'update' action.",
      },
      combineConfig: {
        type: "object",
        description: "Configuration for 'combine' action. Specifies which containers to combine.",
      },
      moveTagIdConfig: {
        type: "object",
        description: "Configuration for 'moveTagId' action. Specifies tag ID mapping for moving tags between containers.",
      },
      page: {
        type: "number",
        description: "Page number for pagination (starts from 1). Each page contains up to itemsPerPage items.",
        default: 1,
      },
      itemsPerPage: {
        type: "number",
        description: `Number of items to return per page (1-${PAGE_SIZES.DEFAULT}). Default: ${PAGE_SIZES.DEFAULT}. Use lower values if experiencing response issues.`,
        default: PAGE_SIZES.DEFAULT,
      },
    },
    required: ["action", "accountId"],
  },
};
