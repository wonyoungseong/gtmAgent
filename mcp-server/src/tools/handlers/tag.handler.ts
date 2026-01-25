/**
 * GTM Tag Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId } from "../../session/index.js";
import {
  getFromFileCacheWithValidation,
  setToFileCache,
  invalidateFileCache,
  getCachedWorkspaceFingerprint,
  setCachedWorkspaceFingerprint,
} from "../../utils/file-cache.js";

export const handleGtmTag = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const containerId = getContainerId(args);
  const workspaceId = getWorkspaceId(args);
  const tagId = args.tagId as string;
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.TAG,
    PAGE_SIZES.TAG
  );
  const refresh = (args.refresh as boolean) || false;

  switch (action) {
    case "create": {
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      if (!config) throw new Error("createOrUpdateConfig is required for create action");
      const response = await tagmanager.accounts.containers.workspaces.tags.create({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        requestBody: config,
      });
      invalidateFileCache(accountId, containerId, workspaceId, "tag");
      return createTextResult(response.data);
    }

    case "get": {
      if (!tagId) throw new Error("tagId is required for get action");
      const response = await tagmanager.accounts.containers.workspaces.tags.get({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
      });
      return createTextResult(response.data);
    }

    case "list": {
      let all: unknown[] | null = null;
      let currentFingerprint: string | null = null;

      // Skip all cache if refresh=true
      if (refresh) {
        invalidateFileCache(accountId, containerId, workspaceId, "tag");
      } else {
        currentFingerprint = getCachedWorkspaceFingerprint(accountId, containerId, workspaceId);
        if (currentFingerprint) {
          const cacheResult = getFromFileCacheWithValidation<unknown>(
            accountId,
            containerId,
            workspaceId,
            "tag",
            currentFingerprint
          );
          if (cacheResult.valid) {
            all = cacheResult.data;
          }
        }
      }

      // Cache miss or refresh: fetch from API
      if (!all) {
        if (!currentFingerprint || refresh) {
          const wsResponse = await tagmanager.accounts.containers.workspaces.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
          });
          currentFingerprint = wsResponse.data.fingerprint as string;
          setCachedWorkspaceFingerprint(accountId, containerId, workspaceId, currentFingerprint);
        }

        all = [];
        let currentPageToken = "";
        do {
          const response = await tagmanager.accounts.containers.workspaces.tags.list({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            pageToken: currentPageToken,
          });
          if (response.data.tag) all = all.concat(response.data.tag);
          currentPageToken = response.data.nextPageToken || "";
        } while (currentPageToken);
        setToFileCache(accountId, containerId, workspaceId, "tag", all, currentFingerprint);
      }

      const paginatedResult = paginateArray(all, page, itemsPerPage);
      return createTextResult(paginatedResult);
    }

    case "update": {
      if (!tagId) throw new Error("tagId is required for update action");
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      const fingerprint = args.fingerprint as string;
      if (!config) throw new Error("createOrUpdateConfig is required for update action");
      if (!fingerprint) throw new Error("fingerprint is required for update action");
      const response = await tagmanager.accounts.containers.workspaces.tags.update({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
        fingerprint,
        requestBody: config,
      });
      invalidateFileCache(accountId, containerId, workspaceId, "tag");
      return createTextResult(response.data);
    }

    case "remove": {
      if (!tagId) throw new Error("tagId is required for remove action");
      await tagmanager.accounts.containers.workspaces.tags.delete({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
      });
      invalidateFileCache(accountId, containerId, workspaceId, "tag");
      return createTextResult({
        success: true,
        message: `Tag ${tagId} was successfully deleted`,
      });
    }

    case "revert": {
      if (!tagId) throw new Error("tagId is required for revert action");
      const fingerprint = args.fingerprint as string;
      const response = await tagmanager.accounts.containers.workspaces.tags.revert({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
        fingerprint,
      });
      return createTextResult(response.data);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
