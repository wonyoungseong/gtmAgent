/**
 * GTM Container Handler
 */
import { createTextResult, paginateArray, PAGE_SIZES } from "../types.js";
import { getAccountId, getOptionalContainerId } from "../../session/index.js";
export const handleGtmContainer = async (tagmanager, args) => {
    const action = args.action;
    const accountId = getAccountId(args);
    const containerId = getOptionalContainerId(args) || "";
    const page = args.page || 1;
    const itemsPerPage = Math.min(args.itemsPerPage || PAGE_SIZES.DEFAULT, PAGE_SIZES.DEFAULT);
    switch (action) {
        case "list": {
            let all = [];
            let currentPageToken = "";
            do {
                const response = await tagmanager.accounts.containers.list({
                    parent: `accounts/${accountId}`,
                    pageToken: currentPageToken,
                });
                if (response.data.container)
                    all = all.concat(response.data.container);
                currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return createTextResult(paginatedResult);
        }
        case "get": {
            if (!containerId)
                throw new Error("containerId is required for get action");
            const response = await tagmanager.accounts.containers.get({
                path: `accounts/${accountId}/containers/${containerId}`,
            });
            return createTextResult(response.data);
        }
        case "create":
        case "update":
        case "remove": {
            throw new Error(`SAFETY: Container ${action} action is disabled. Creating, updating, or removing containers is not allowed via API for safety reasons. Please use GTM UI.`);
        }
        case "combine": {
            if (!containerId)
                throw new Error("containerId is required for combine action");
            const combineConfig = args.combineConfig;
            if (!combineConfig)
                throw new Error("combineConfig is required for combine action");
            const response = await tagmanager.accounts.containers.combine({
                path: `accounts/${accountId}/containers/${containerId}`,
                ...combineConfig,
            });
            return createTextResult(response.data);
        }
        case "lookup": {
            const destinationId = args.destinationId;
            if (!destinationId)
                throw new Error("destinationId is required for lookup action");
            const response = await tagmanager.accounts.containers.lookup({
                destinationId,
            });
            return createTextResult(response.data);
        }
        case "moveTagId": {
            if (!containerId)
                throw new Error("containerId is required for moveTagId action");
            const moveTagIdConfig = args.moveTagIdConfig;
            if (!moveTagIdConfig)
                throw new Error("moveTagIdConfig is required for moveTagId action");
            const response = await tagmanager.accounts.containers.move_tag_id({
                path: `accounts/${accountId}/containers/${containerId}`,
                ...moveTagIdConfig,
            });
            return createTextResult(response.data);
        }
        case "snippet": {
            if (!containerId)
                throw new Error("containerId is required for snippet action");
            const response = await tagmanager.accounts.containers.snippet({
                path: `accounts/${accountId}/containers/${containerId}`,
            });
            return createTextResult(response.data);
        }
        default:
            throw new Error(`Unknown action: ${action}`);
    }
};
