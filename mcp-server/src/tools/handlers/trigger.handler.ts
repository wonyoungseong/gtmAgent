/**
 * GTM Trigger Handler
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

export const handleGtmTrigger = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const containerId = getContainerId(args);
  const workspaceId = getWorkspaceId(args);
  const triggerId = args.triggerId as string;
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.TRIGGER,
    PAGE_SIZES.TRIGGER
  );
  const refresh = (args.refresh as boolean) || false;

  switch (action) {
    case "create": {
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      if (!config) throw new Error("createOrUpdateConfig is required for create action");
      const response = await tagmanager.accounts.containers.workspaces.triggers.create({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        requestBody: config,
      });
      invalidateFileCache(accountId, containerId, workspaceId, "trigger");
      return createTextResult(response.data);
    }

    case "get": {
      if (!triggerId) throw new Error("triggerId is required for get action");
      const response = await tagmanager.accounts.containers.workspaces.triggers.get({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
      });
      return createTextResult(response.data);
    }

    case "list": {
      let all: unknown[] | null = null;
      let currentFingerprint: string | null = null;

      if (refresh) {
        invalidateFileCache(accountId, containerId, workspaceId, "trigger");
      } else {
        currentFingerprint = getCachedWorkspaceFingerprint(accountId, containerId, workspaceId);
        if (currentFingerprint) {
          const cacheResult = getFromFileCacheWithValidation<unknown>(
            accountId,
            containerId,
            workspaceId,
            "trigger",
            currentFingerprint
          );
          if (cacheResult.valid) {
            all = cacheResult.data;
          }
        }
      }

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
          const response = await tagmanager.accounts.containers.workspaces.triggers.list({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            pageToken: currentPageToken,
          });
          if (response.data.trigger) all = all.concat(response.data.trigger);
          currentPageToken = response.data.nextPageToken || "";
        } while (currentPageToken);
        setToFileCache(accountId, containerId, workspaceId, "trigger", all, currentFingerprint);
      }

      const paginatedResult = paginateArray(all, page, itemsPerPage);
      return createTextResult(paginatedResult);
    }

    case "update": {
      if (!triggerId) throw new Error("triggerId is required for update action");
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      const fingerprint = args.fingerprint as string;
      if (!config) throw new Error("createOrUpdateConfig is required for update action");
      if (!fingerprint) throw new Error("fingerprint is required for update action");
      const response = await tagmanager.accounts.containers.workspaces.triggers.update({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
        fingerprint,
        requestBody: config,
      });
      invalidateFileCache(accountId, containerId, workspaceId, "trigger");
      return createTextResult(response.data);
    }

    case "remove": {
      if (!triggerId) throw new Error("triggerId is required for remove action");
      await tagmanager.accounts.containers.workspaces.triggers.delete({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
      });
      invalidateFileCache(accountId, containerId, workspaceId, "trigger");
      return createTextResult({
        success: true,
        message: `Trigger ${triggerId} was successfully deleted`,
      });
    }

    case "revert": {
      if (!triggerId) throw new Error("triggerId is required for revert action");
      const fingerprint = args.fingerprint as string;
      const response = await tagmanager.accounts.containers.workspaces.triggers.revert({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
        fingerprint,
      });
      return createTextResult(response.data);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
