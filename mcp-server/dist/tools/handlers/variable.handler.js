/**
 * GTM Variable Handler
 */
import { createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId } from "../../session/index.js";
import { getFromFileCacheWithValidation, setToFileCache, invalidateFileCache, getCachedWorkspaceFingerprint, setCachedWorkspaceFingerprint, } from "../../utils/file-cache.js";
export const handleGtmVariable = async (tagmanager, args) => {
    const action = args.action;
    const accountId = getAccountId(args);
    const containerId = getContainerId(args);
    const workspaceId = getWorkspaceId(args);
    const variableId = args.variableId;
    const page = args.page || 1;
    const itemsPerPage = Math.min(args.itemsPerPage || PAGE_SIZES.VARIABLE, PAGE_SIZES.VARIABLE);
    const refresh = args.refresh || false;
    switch (action) {
        case "create": {
            const config = args.createOrUpdateConfig;
            if (!config)
                throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.variables.create({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                requestBody: config,
            });
            invalidateFileCache(accountId, containerId, workspaceId, "variable");
            return createTextResult(response.data);
        }
        case "get": {
            if (!variableId)
                throw new Error("variableId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.variables.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
            });
            return createTextResult(response.data);
        }
        case "list": {
            let all = null;
            let currentFingerprint = null;
            if (refresh) {
                invalidateFileCache(accountId, containerId, workspaceId, "variable");
            }
            else {
                currentFingerprint = getCachedWorkspaceFingerprint(accountId, containerId, workspaceId);
                if (currentFingerprint) {
                    const cacheResult = getFromFileCacheWithValidation(accountId, containerId, workspaceId, "variable", currentFingerprint);
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
                    currentFingerprint = wsResponse.data.fingerprint;
                    setCachedWorkspaceFingerprint(accountId, containerId, workspaceId, currentFingerprint);
                }
                all = [];
                let currentPageToken = "";
                do {
                    const response = await tagmanager.accounts.containers.workspaces.variables.list({
                        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                        pageToken: currentPageToken,
                    });
                    if (response.data.variable)
                        all = all.concat(response.data.variable);
                    currentPageToken = response.data.nextPageToken || "";
                } while (currentPageToken);
                setToFileCache(accountId, containerId, workspaceId, "variable", all, currentFingerprint);
            }
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return createTextResult(paginatedResult);
        }
        case "update": {
            if (!variableId)
                throw new Error("variableId is required for update action");
            const config = args.createOrUpdateConfig;
            const fingerprint = args.fingerprint;
            if (!config)
                throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint)
                throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.variables.update({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
                fingerprint,
                requestBody: config,
            });
            invalidateFileCache(accountId, containerId, workspaceId, "variable");
            return createTextResult(response.data);
        }
        case "remove": {
            if (!variableId)
                throw new Error("variableId is required for remove action");
            await tagmanager.accounts.containers.workspaces.variables.delete({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
            });
            invalidateFileCache(accountId, containerId, workspaceId, "variable");
            return createTextResult({
                success: true,
                message: `Variable ${variableId} was successfully deleted`,
            });
        }
        case "revert": {
            if (!variableId)
                throw new Error("variableId is required for revert action");
            const fingerprint = args.fingerprint;
            const response = await tagmanager.accounts.containers.workspaces.variables.revert({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
                fingerprint,
            });
            return createTextResult(response.data);
        }
        default:
            throw new Error(`Unknown action: ${action}`);
    }
};
