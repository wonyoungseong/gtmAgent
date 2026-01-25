/**
 * GTM Folder Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId } from "../../session/index.js";

export const handleGtmFolder = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const containerId = getContainerId(args);
  const workspaceId = getWorkspaceId(args);
  const folderId = args.folderId as string;
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.DEFAULT,
    PAGE_SIZES.DEFAULT
  );

  switch (action) {
    case "create": {
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      if (!config) throw new Error("createOrUpdateConfig is required for create action");
      const response = await tagmanager.accounts.containers.workspaces.folders.create({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "get": {
      if (!folderId) throw new Error("folderId is required for get action");
      const response = await tagmanager.accounts.containers.workspaces.folders.get({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
      });
      return createTextResult(response.data);
    }

    case "list": {
      let all: unknown[] = [];
      let currentPageToken = "";
      do {
        const response = await tagmanager.accounts.containers.workspaces.folders.list({
          parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
          pageToken: currentPageToken,
        });
        if (response.data.folder) all = all.concat(response.data.folder);
        currentPageToken = response.data.nextPageToken || "";
      } while (currentPageToken);
      const paginatedResult = paginateArray(all, page, itemsPerPage);
      return createTextResult(paginatedResult);
    }

    case "update": {
      if (!folderId) throw new Error("folderId is required for update action");
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      const fingerprint = args.fingerprint as string;
      if (!config) throw new Error("createOrUpdateConfig is required for update action");
      const response = await tagmanager.accounts.containers.workspaces.folders.update({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
        fingerprint,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "remove": {
      if (!folderId) throw new Error("folderId is required for remove action");
      await tagmanager.accounts.containers.workspaces.folders.delete({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
      });
      return createTextResult({
        success: true,
        message: `Folder ${folderId} was successfully deleted`,
      });
    }

    case "revert": {
      if (!folderId) throw new Error("folderId is required for revert action");
      const fingerprint = args.fingerprint as string;
      const response = await tagmanager.accounts.containers.workspaces.folders.revert({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
        fingerprint,
      });
      return createTextResult(response.data);
    }

    case "entities": {
      if (!folderId) throw new Error("folderId is required for entities action");
      const response = await tagmanager.accounts.containers.workspaces.folders.entities({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
      });
      return createTextResult(response.data);
    }

    case "moveEntitiesToFolder": {
      if (!folderId) throw new Error("folderId is required for moveEntitiesToFolder action");
      const tagId = args.tagId as string[];
      const triggerId = args.triggerId as string[];
      const variableId = args.variableId as string[];
      const response = await tagmanager.accounts.containers.workspaces.folders.move_entities_to_folder({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
        tagId,
        triggerId,
        variableId,
      });
      return createTextResult(response.data);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
