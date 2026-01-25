/**
 * GTM Gtag Config Handler
 */
import { createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId } from "../../session/index.js";
export const handleGtmGtagConfig = async (tagmanager, args) => {
    const action = args.action;
    const accountId = getAccountId(args);
    const containerId = getContainerId(args);
    const workspaceId = getWorkspaceId(args);
    const gtagConfigId = args.gtagConfigId;
    const page = args.page || 1;
    const itemsPerPage = Math.min(args.itemsPerPage || PAGE_SIZES.DEFAULT, PAGE_SIZES.DEFAULT);
    switch (action) {
        case "create": {
            const config = args.createOrUpdateConfig;
            if (!config)
                throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.gtag_config.create({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                requestBody: config,
            });
            return createTextResult(response.data);
        }
        case "get": {
            if (!gtagConfigId)
                throw new Error("gtagConfigId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.gtag_config.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`,
            });
            return createTextResult(response.data);
        }
        case "list": {
            let all = [];
            let currentPageToken = "";
            do {
                const response = await tagmanager.accounts.containers.workspaces.gtag_config.list({
                    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                    pageToken: currentPageToken,
                });
                if (response.data.gtagConfig)
                    all = all.concat(response.data.gtagConfig);
                currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return createTextResult(paginatedResult);
        }
        case "update": {
            if (!gtagConfigId)
                throw new Error("gtagConfigId is required for update action");
            const config = args.createOrUpdateConfig;
            const fingerprint = args.fingerprint;
            if (!config)
                throw new Error("createOrUpdateConfig is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.gtag_config.update({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`,
                fingerprint,
                requestBody: config,
            });
            return createTextResult(response.data);
        }
        case "remove": {
            if (!gtagConfigId)
                throw new Error("gtagConfigId is required for remove action");
            await tagmanager.accounts.containers.workspaces.gtag_config.delete({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`,
            });
            return createTextResult({
                success: true,
                message: `Gtag config ${gtagConfigId} was successfully deleted`,
            });
        }
        default:
            throw new Error(`Unknown action: ${action}`);
    }
};
