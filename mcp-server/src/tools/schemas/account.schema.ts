/**
 * gtm_account Tool Schema
 * GTM Account 관리
 */

import { ToolSchema } from "../types.js";

export const gtmAccountSchema: ToolSchema = {
  name: "gtm_account",
  description: "Performs all account-related operations: get, list, update. Use the 'action' parameter to select the operation. 'list' requires no additional params. 'get' and 'update' require accountId.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get", "list", "update"],
        description: "The account operation to perform. 'list': returns all accessible accounts (no accountId needed). 'get': returns specific account (requires accountId). 'update': updates account (requires accountId and config).",
      },
      accountId: {
        type: "string",
        description: "The unique ID of the GTM Account. Required for 'get' and 'update' actions. Not needed for 'list'.",
      },
      config: {
        type: "object",
        description: "Configuration for 'update' action. All fields correspond to the GTM Account resource.",
      },
    },
    required: ["action"],
  },
};
