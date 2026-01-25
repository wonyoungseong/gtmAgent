/**
 * GTM Version Handler
 */
import { createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId } from "../../session/index.js";
// Helper function to process version data with pagination for specific resource types
const processVersionData = (data, resourceType, page, itemsPerPage) => {
    if (!resourceType) {
        return data;
    }
    const resourceArray = data[resourceType];
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
export const handleGtmVersion = async (tagmanager, args) => {
    const action = args.action;
    const accountId = getAccountId(args);
    const containerId = getContainerId(args);
    const containerVersionId = args.containerVersionId;
    const resourceType = args.resourceType;
    const page = args.page || 1;
    const itemsPerPage = Math.min(args.itemsPerPage || PAGE_SIZES.VERSION, PAGE_SIZES.VERSION);
    switch (action) {
        case "get": {
            if (!containerVersionId)
                throw new Error("containerVersionId is required for get action");
            const response = await tagmanager.accounts.containers.versions.get({
                path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
            });
            const processedData = processVersionData(response.data, resourceType, page, itemsPerPage);
            return createTextResult(processedData);
        }
        case "live": {
            const response = await tagmanager.accounts.containers.versions.live({
                parent: `accounts/${accountId}/containers/${containerId}`,
            });
            const processedData = processVersionData(response.data, resourceType, page, itemsPerPage);
            return createTextResult(processedData);
        }
        case "publish":
        case "remove": {
            throw new Error(`SAFETY: Version ${action} action is disabled. Publishing and removing versions are not allowed via API for safety reasons. Please use GTM UI.`);
        }
        case "setLatest": {
            if (!containerVersionId)
                throw new Error("containerVersionId is required for setLatest action");
            const response = await tagmanager.accounts.containers.versions.set_latest({
                path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
            });
            return createTextResult(response.data);
        }
        case "undelete": {
            if (!containerVersionId)
                throw new Error("containerVersionId is required for undelete action");
            const response = await tagmanager.accounts.containers.versions.undelete({
                path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
            });
            return createTextResult(response.data);
        }
        case "update": {
            if (!containerVersionId)
                throw new Error("containerVersionId is required for update action");
            const config = args.createOrUpdateConfig;
            const fingerprint = args.fingerprint;
            if (!config)
                throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint)
                throw new Error("fingerprint is required for update action");
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
