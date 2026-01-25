/**
 * GTM Workspace Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId, getOptionalWorkspaceId } from "../../session/index.js";

export const handleGtmWorkspace = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const containerId = getContainerId(args);
  const workspaceId = getOptionalWorkspaceId(args) || "";
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.DEFAULT,
    PAGE_SIZES.DEFAULT
  );

  switch (action) {
    case "create": {
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      if (!config) throw new Error("createOrUpdateConfig is required for create action");
      const response = await tagmanager.accounts.containers.workspaces.create({
        parent: `accounts/${accountId}/containers/${containerId}`,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "get": {
      const wsId = workspaceId || getWorkspaceId(args);
      const response = await tagmanager.accounts.containers.workspaces.get({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${wsId}`,
      });
      return createTextResult(response.data);
    }

    case "list": {
      let all: unknown[] = [];
      let currentPageToken = "";
      do {
        const response = await tagmanager.accounts.containers.workspaces.list({
          parent: `accounts/${accountId}/containers/${containerId}`,
          pageToken: currentPageToken,
        });
        if (response.data.workspace) all = all.concat(response.data.workspace);
        currentPageToken = response.data.nextPageToken || "";
      } while (currentPageToken);
      const paginatedResult = paginateArray(all, page, itemsPerPage);
      return createTextResult(paginatedResult);
    }

    case "update": {
      if (!workspaceId) throw new Error("workspaceId is required for update action");
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      const fingerprint = args.fingerprint as string;
      if (!config) throw new Error("createOrUpdateConfig is required for update action");
      const response = await tagmanager.accounts.containers.workspaces.update({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        fingerprint,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "remove": {
      if (!workspaceId) throw new Error("workspaceId is required for remove action");
      await tagmanager.accounts.containers.workspaces.delete({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
      });
      return createTextResult({
        success: true,
        message: `Workspace ${workspaceId} removed successfully`,
      });
    }

    case "createVersion": {
      if (!workspaceId) throw new Error("workspaceId is required for createVersion action");
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      const response = await tagmanager.accounts.containers.workspaces.create_version({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        requestBody: config || {},
      });
      return createTextResult(response.data);
    }

    case "getStatus": {
      if (!workspaceId) throw new Error("workspaceId is required for getStatus action");
      const response = await tagmanager.accounts.containers.workspaces.getStatus({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
      });
      return createTextResult(response.data);
    }

    case "sync": {
      if (!workspaceId) throw new Error("workspaceId is required for sync action");
      const response = await tagmanager.accounts.containers.workspaces.sync({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
      });
      return createTextResult(response.data);
    }

    case "quickPreview": {
      if (!workspaceId) throw new Error("workspaceId is required for quickPreview action");
      const response = await tagmanager.accounts.containers.workspaces.quick_preview({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
      });
      return createTextResult(response.data);
    }

    case "resolveConflict": {
      if (!workspaceId) throw new Error("workspaceId is required for resolveConflict action");
      const fingerprint = args.fingerprint as string;
      const entity = args.entity as Record<string, unknown>;
      const changeStatus = args.changeStatus as string;
      if (!fingerprint) throw new Error("fingerprint is required for resolveConflict action");
      if (!entity) throw new Error("entity is required for resolveConflict action");
      if (!changeStatus) throw new Error("changeStatus is required for resolveConflict action");
      const entityName = Object.keys(entity);
      await tagmanager.accounts.containers.workspaces.resolve_conflict({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        fingerprint,
        requestBody: {
          changeStatus,
          [entityName[0]]: entity[entityName[0]],
        } as unknown as Record<string, unknown>,
      });
      return createTextResult({
        success: true,
        message: `Conflict resolved in workspace ${workspaceId}`,
      });
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
