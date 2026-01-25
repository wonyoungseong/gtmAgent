/**
 * GTM Destination Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId } from "../../session/index.js";

export const handleGtmDestination = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const containerId = getContainerId(args);
  const destinationId = args.destinationId as string;
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.DEFAULT,
    PAGE_SIZES.DEFAULT
  );

  switch (action) {
    case "get": {
      if (!destinationId) throw new Error("destinationId is required for get action");
      const response = await tagmanager.accounts.containers.destinations.get({
        path: `accounts/${accountId}/containers/${containerId}/destinations/${destinationId}`,
      });
      return createTextResult(response.data);
    }

    case "list": {
      const response = await tagmanager.accounts.containers.destinations.list({
        parent: `accounts/${accountId}/containers/${containerId}`,
      });
      const all = response.data.destination || [];
      const paginatedResult = paginateArray(all, page, itemsPerPage);
      return createTextResult(paginatedResult);
    }

    case "link": {
      if (!destinationId) throw new Error("destinationId is required for link action");
      const allowUserPermissionFeatureUpdate = args.allowUserPermissionFeatureUpdate as boolean;
      const response = await tagmanager.accounts.containers.destinations.link({
        parent: `accounts/${accountId}/containers/${containerId}`,
        destinationId,
        allowUserPermissionFeatureUpdate,
      });
      return createTextResult(response.data);
    }

    case "unlink": {
      // Note: The GTM API doesn't have a direct unlink method, but we can implement it if needed
      throw new Error("Destination unlink is not directly supported by GTM API");
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
