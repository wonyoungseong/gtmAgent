/**
 * GTM Transformation Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId } from "../../session/index.js";

export const handleGtmTransformation = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const containerId = getContainerId(args);
  const workspaceId = getWorkspaceId(args);
  const transformationId = args.transformationId as string;
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.DEFAULT,
    PAGE_SIZES.DEFAULT
  );

  switch (action) {
    case "create": {
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      if (!config) throw new Error("createOrUpdateConfig is required for create action");
      const response = await tagmanager.accounts.containers.workspaces.transformations.create({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "get": {
      if (!transformationId) throw new Error("transformationId is required for get action");
      const response = await tagmanager.accounts.containers.workspaces.transformations.get({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}`,
      });
      return createTextResult(response.data);
    }

    case "list": {
      let all: unknown[] = [];
      let currentPageToken = "";
      do {
        const response = await tagmanager.accounts.containers.workspaces.transformations.list({
          parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
          pageToken: currentPageToken,
        });
        if (response.data.transformation) all = all.concat(response.data.transformation);
        currentPageToken = response.data.nextPageToken || "";
      } while (currentPageToken);
      const paginatedResult = paginateArray(all, page, itemsPerPage);
      return createTextResult(paginatedResult);
    }

    case "update": {
      if (!transformationId) throw new Error("transformationId is required for update action");
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      const fingerprint = args.fingerprint as string;
      if (!config) throw new Error("createOrUpdateConfig is required for update action");
      if (!fingerprint) throw new Error("fingerprint is required for update action");
      const response = await tagmanager.accounts.containers.workspaces.transformations.update({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}`,
        fingerprint,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "remove": {
      if (!transformationId) throw new Error("transformationId is required for remove action");
      await tagmanager.accounts.containers.workspaces.transformations.delete({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}`,
      });
      return createTextResult({
        success: true,
        message: `Transformation ${transformationId} was successfully deleted`,
      });
    }

    case "revert": {
      if (!transformationId) throw new Error("transformationId is required for revert action");
      const fingerprint = args.fingerprint as string;
      const response = await tagmanager.accounts.containers.workspaces.transformations.revert({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}`,
        fingerprint,
      });
      return createTextResult(response.data);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
