/**
 * GTM Version Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId } from "../../session/index.js";

// Helper function to process version data with pagination for specific resource types
const processVersionData = (
  data: Record<string, unknown>,
  resourceType: string | undefined,
  page: number,
  itemsPerPage: number
): Record<string, unknown> => {
  if (!resourceType) {
    return data;
  }

  const resourceArray = data[resourceType] as unknown[] | undefined;
  if (!resourceArray || !Array.isArray(resourceArray)) {
    return data;
  }

  const paginatedResult = paginateArray(resourceArray, page, itemsPerPage);
  return {
    ...data,
    [resourceType]: paginatedResult.data,
    [`${resourceType}Pagination`]: paginatedResult.pagination,
  };
};

export const handleGtmVersion = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const containerId = getContainerId(args);
  const containerVersionId = args.containerVersionId as string;
  const resourceType = args.resourceType as string | undefined;
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.VERSION,
    PAGE_SIZES.VERSION
  );

  switch (action) {
    case "get": {
      if (!containerVersionId) throw new Error("containerVersionId is required for get action");
      const response = await tagmanager.accounts.containers.versions.get({
        path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
      });
      const processedData = processVersionData(
        response.data as Record<string, unknown>,
        resourceType,
        page,
        itemsPerPage
      );
      return createTextResult(processedData);
    }

    case "live": {
      const response = await tagmanager.accounts.containers.versions.live({
        parent: `accounts/${accountId}/containers/${containerId}`,
      });
      const processedData = processVersionData(
        response.data as Record<string, unknown>,
        resourceType,
        page,
        itemsPerPage
      );
      return createTextResult(processedData);
    }

    case "publish":
    case "remove": {
      throw new Error(
        `SAFETY: Version ${action} action is disabled. Publishing and removing versions are not allowed via API for safety reasons. Please use GTM UI.`
      );
    }

    case "setLatest": {
      if (!containerVersionId) throw new Error("containerVersionId is required for setLatest action");
      const response = await tagmanager.accounts.containers.versions.set_latest({
        path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
      });
      return createTextResult(response.data);
    }

    case "undelete": {
      if (!containerVersionId) throw new Error("containerVersionId is required for undelete action");
      const response = await tagmanager.accounts.containers.versions.undelete({
        path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
      });
      return createTextResult(response.data);
    }

    case "update": {
      if (!containerVersionId) throw new Error("containerVersionId is required for update action");
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      const fingerprint = args.fingerprint as string;
      if (!config) throw new Error("createOrUpdateConfig is required for update action");
      if (!fingerprint) throw new Error("fingerprint is required for update action");
      const response = await tagmanager.accounts.containers.versions.update({
        path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
        fingerprint,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
