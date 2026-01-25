/**
 * GTM Zone Handler
 */
import { createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId } from "../../session/index.js";
export const handleGtmZone = async (tagmanager, args) => {
    const action = args.action;
    const accountId = getAccountId(args);
    const containerId = getContainerId(args);
    const workspaceId = getWorkspaceId(args);
    const zoneId = args.zoneId;
    const page = args.page || 1;
    const itemsPerPage = Math.min(args.itemsPerPage || PAGE_SIZES.ZONE, PAGE_SIZES.ZONE);
    switch (action) {
        case "create": {
            const config = args.createOrUpdateConfig;
            if (!config)
                throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.zones.create({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                requestBody: config,
            });
            return createTextResult(response.data);
        }
        case "get": {
            if (!zoneId)
                throw new Error("zoneId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.zones.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
            });
            return createTextResult(response.data);
        }
        case "list": {
            let all = [];
            let currentPageToken = "";
            do {
                const response = await tagmanager.accounts.containers.workspaces.zones.list({
                    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                    pageToken: currentPageToken,
                });
                if (response.data.zone)
                    all = all.concat(response.data.zone);
                currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return createTextResult(paginatedResult);
        }
        case "update": {
            if (!zoneId)
                throw new Error("zoneId is required for update action");
            const config = args.createOrUpdateConfig;
            const fingerprint = args.fingerprint;
            if (!config)
                throw new Error("createOrUpdateConfig is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.zones.update({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
                fingerprint,
                requestBody: config,
            });
            return createTextResult(response.data);
        }
        case "remove": {
            if (!zoneId)
                throw new Error("zoneId is required for remove action");
            await tagmanager.accounts.containers.workspaces.zones.delete({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
            });
            return createTextResult({
                success: true,
                message: `Zone ${zoneId} removed successfully`,
            });
        }
        case "revert": {
            if (!zoneId)
                throw new Error("zoneId is required for revert action");
            const fingerprint = args.fingerprint;
            const response = await tagmanager.accounts.containers.workspaces.zones.revert({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
                fingerprint,
            });
            return createTextResult(response.data);
        }
        default:
            throw new Error(`Unknown action: ${action}`);
    }
};
