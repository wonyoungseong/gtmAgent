/**
 * GTM Client Handler
 */
import { createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId } from "../../session/index.js";
export const handleGtmClient = async (tagmanager, args) => {
    const action = args.action;
    const accountId = getAccountId(args);
    const containerId = getContainerId(args);
    const workspaceId = getWorkspaceId(args);
    const clientId = args.clientId;
    const page = args.page || 1;
    const itemsPerPage = Math.min(args.itemsPerPage || PAGE_SIZES.DEFAULT, PAGE_SIZES.DEFAULT);
    switch (action) {
        case "create": {
            const config = args.createOrUpdateConfig;
            if (!config)
                throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.clients.create({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                requestBody: config,
            });
            return createTextResult(response.data);
        }
        case "get": {
            if (!clientId)
                throw new Error("clientId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.clients.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
            });
            return createTextResult(response.data);
        }
        case "list": {
            let all = [];
            let currentPageToken = "";
            do {
                const response = await tagmanager.accounts.containers.workspaces.clients.list({
                    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                    pageToken: currentPageToken,
                });
                if (response.data.client)
                    all = all.concat(response.data.client);
                currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return createTextResult(paginatedResult);
        }
        case "update": {
            if (!clientId)
                throw new Error("clientId is required for update action");
            const config = args.createOrUpdateConfig;
            const fingerprint = args.fingerprint;
            if (!config)
                throw new Error("createOrUpdateConfig is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.clients.update({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
                fingerprint,
                requestBody: config,
            });
            return createTextResult(response.data);
        }
        case "remove": {
            if (!clientId)
                throw new Error("clientId is required for remove action");
            await tagmanager.accounts.containers.workspaces.clients.delete({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
            });
            return createTextResult({
                success: true,
                message: `Client ${clientId} was successfully deleted`,
            });
        }
        case "revert": {
            if (!clientId)
                throw new Error("clientId is required for revert action");
            const fingerprint = args.fingerprint;
            const response = await tagmanager.accounts.containers.workspaces.clients.revert({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
                fingerprint,
            });
            return createTextResult(response.data);
        }
        default:
            throw new Error(`Unknown action: ${action}`);
    }
};
