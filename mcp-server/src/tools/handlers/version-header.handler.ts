/**
 * GTM Version Header Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId } from "../../session/index.js";

export const handleGtmVersionHeader = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const containerId = getContainerId(args);
  const includeDeleted = args.includeDeleted as boolean;
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.DEFAULT,
    PAGE_SIZES.DEFAULT
  );

  switch (action) {
    case "list": {
      let all: unknown[] = [];
      let currentPageToken = "";
      do {
        const response = await tagmanager.accounts.containers.version_headers.list({
          parent: `accounts/${accountId}/containers/${containerId}`,
          includeDeleted,
          pageToken: currentPageToken,
        });
        if (response.data.containerVersionHeader) {
          all = all.concat(response.data.containerVersionHeader);
        }
        currentPageToken = response.data.nextPageToken || "";
      } while (currentPageToken);
      const paginatedResult = paginateArray(all, page, itemsPerPage);
      return createTextResult(paginatedResult);
    }

    case "latest": {
      const response = await tagmanager.accounts.containers.version_headers.latest({
        parent: `accounts/${accountId}/containers/${containerId}`,
      });
      return createTextResult(response.data);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
