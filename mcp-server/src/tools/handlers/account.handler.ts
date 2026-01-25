/**
 * GTM Account Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult } from "../types.js";

export const handleGtmAccount = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = args.accountId as string;

  switch (action) {
    case "list": {
      const response = await tagmanager.accounts.list({});
      return createTextResult(response.data);
    }

    case "get": {
      if (!accountId) throw new Error("accountId is required for get action");
      const response = await tagmanager.accounts.get({
        path: `accounts/${accountId}`,
      });
      return createTextResult(response.data);
    }

    case "update": {
      if (!accountId) throw new Error("accountId is required for update action");
      const config = args.config as Record<string, unknown>;
      if (!config) throw new Error("config is required for update action");
      const response = await tagmanager.accounts.update({
        path: `accounts/${accountId}`,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
