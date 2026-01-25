/**
 * GTM Environment Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId } from "../../session/index.js";

export const handleGtmEnvironment = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = getAccountId(args);
  const containerId = getContainerId(args);
  const environmentId = args.environmentId as string;
  const page = (args.page as number) || 1;
  const itemsPerPage = Math.min(
    (args.itemsPerPage as number) || PAGE_SIZES.DEFAULT,
    PAGE_SIZES.DEFAULT
  );

  switch (action) {
    case "create": {
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      if (!config) throw new Error("createOrUpdateConfig is required for create action");
      const response = await tagmanager.accounts.containers.environments.create({
        parent: `accounts/${accountId}/containers/${containerId}`,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "get": {
      if (!environmentId) throw new Error("environmentId is required for get action");
      const response = await tagmanager.accounts.containers.environments.get({
        path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
      });
      return createTextResult(response.data);
    }

    case "list": {
      let all: unknown[] = [];
      let currentPageToken = "";
      do {
        const response = await tagmanager.accounts.containers.environments.list({
          parent: `accounts/${accountId}/containers/${containerId}`,
          pageToken: currentPageToken,
        });
        if (response.data.environment) all = all.concat(response.data.environment);
        currentPageToken = response.data.nextPageToken || "";
      } while (currentPageToken);
      const paginatedResult = paginateArray(all, page, itemsPerPage);
      return createTextResult(paginatedResult);
    }

    case "update": {
      if (!environmentId) throw new Error("environmentId is required for update action");
      const config = args.createOrUpdateConfig as Record<string, unknown>;
      const fingerprint = args.fingerprint as string;
      if (!config) throw new Error("createOrUpdateConfig is required for update action");
      const response = await tagmanager.accounts.containers.environments.update({
        path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
        fingerprint,
        requestBody: config,
      });
      return createTextResult(response.data);
    }

    case "remove": {
      if (!environmentId) throw new Error("environmentId is required for remove action");
      await tagmanager.accounts.containers.environments.delete({
        path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
      });
      return createTextResult({
        success: true,
        message: `Environment ${environmentId} was successfully deleted`,
      });
    }

    case "reauthorize": {
      if (!environmentId) throw new Error("environmentId is required for reauthorize action");
      const response = await tagmanager.accounts.containers.environments.reauthorize({
        path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
      });
      return createTextResult(response.data);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
