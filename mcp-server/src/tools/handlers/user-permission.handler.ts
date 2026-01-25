/**
 * GTM User Permission Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId } from "../../session/index.js";

export const handleGtmUserPermission = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const userPermissionId = args.userPermissionId as string;
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.DEFAULT,
    PAGE_SIZES.DEFAULT
  );

  switch (action) {
    case "create": {
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      if (!config) throw new Error("createOrUpdateConfig is required for create action");
      const response = await tagmanager.accounts.user_permissions.create({
        parent: `accounts/${accountId}`,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "get": {
      if (!userPermissionId) throw new Error("userPermissionId is required for get action");
      const response = await tagmanager.accounts.user_permissions.get({
        path: `accounts/${accountId}/user_permissions/${userPermissionId}`,
      });
      return createTextResult(response.data);
    }

    case "list": {
      let all: unknown[] = [];
      let currentPageToken = "";
      do {
        const response = await tagmanager.accounts.user_permissions.list({
          parent: `accounts/${accountId}`,
          pageToken: currentPageToken,
        });
        if (response.data.userPermission) all = all.concat(response.data.userPermission);
        currentPageToken = response.data.nextPageToken || "";
      } while (currentPageToken);
      const paginatedResult = paginateArray(all, page, itemsPerPage);
      return createTextResult(paginatedResult);
    }

    case "update": {
      if (!userPermissionId) throw new Error("userPermissionId is required for update action");
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      if (!config) throw new Error("createOrUpdateConfig is required for update action");
      const response = await tagmanager.accounts.user_permissions.update({
        path: `accounts/${accountId}/user_permissions/${userPermissionId}`,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "remove": {
      if (!userPermissionId) throw new Error("userPermissionId is required for remove action");
      await tagmanager.accounts.user_permissions.delete({
        path: `accounts/${accountId}/user_permissions/${userPermissionId}`,
      });
      return createTextResult({
        success: true,
        message: `User permission ${userPermissionId} was successfully deleted`,
      });
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
