/**
 * GTM Built-in Variable Handler
 */
import { createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId } from "../../session/index.js";
export const handleGtmBuiltInVariable = async (tagmanager, args) => {
    const action = args.action;
    const accountId = getAccountId(args);
    const containerId = getContainerId(args);
    const workspaceId = getWorkspaceId(args);
    const types = args.types;
    const type = args.type;
    const page = args.page || 1;
    const itemsPerPage = Math.min(args.itemsPerPage || PAGE_SIZES.DEFAULT, PAGE_SIZES.DEFAULT);
    switch (action) {
        case "create": {
            if (!types)
                throw new Error("types is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.built_in_variables.create({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                type: types,
            });
            return createTextResult(response.data);
        }
        case "list": {
            let all = [];
            let currentPageToken = "";
            do {
                const response = await tagmanager.accounts.containers.workspaces.built_in_variables.list({
                    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                    pageToken: currentPageToken,
                });
                if (response.data.builtInVariable)
                    all = all.concat(response.data.builtInVariable);
                currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return createTextResult(paginatedResult);
        }
        case "remove": {
            if (!types)
                throw new Error("types is required for remove action");
            await tagmanager.accounts.containers.workspaces.built_in_variables.delete({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/built_in_variables`,
                type: types,
            });
            return createTextResult({
                success: true,
                message: "Built-in variables deleted",
            });
        }
        case "revert": {
            if (!type)
                throw new Error("type is required for revert action");
            const response = await tagmanager.accounts.containers.workspaces.built_in_variables.revert({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/built_in_variables`,
                type,
            });
            return createTextResult(response.data);
        }
        default:
            throw new Error(`Unknown action: ${action}`);
    }
};
