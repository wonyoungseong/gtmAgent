/**
 * gtm_tag Tool Schema
 * GTM Tag 관리
 */
import { PAGE_SIZES } from "../types.js";
export const gtmTagSchema = {
    name: "gtm_tag",
    description: `Performs all GTM tag operations: create, get, list, update, remove, revert. The 'list' action returns up to ${PAGE_SIZES.TAG} items per page.`,
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["create", "get", "list", "update", "remove", "revert"],
                description: "The GTM tag operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove', 'revert'.",
            },
            accountId: {
                type: "string",
                description: "The unique ID of the GTM Account containing the tag.",
            },
            containerId: {
                type: "string",
                description: "The unique ID of the GTM Container containing the tag.",
            },
            workspaceId: {
                type: "string",
                description: "The unique ID of the GTM Workspace containing the tag.",
            },
            tagId: {
                type: "string",
                description: "The unique ID of the GTM tag. Required for 'get', 'update', 'remove', and 'revert' actions.",
            },
            createOrUpdateConfig: {
                type: "object",
                description: "Configuration for 'create' and 'update' actions.",
            },
            fingerprint: {
                type: "string",
                description: "The fingerprint for optimistic concurrency control. Required for 'update' and 'revert' actions.",
            },
            page: {
                type: "number",
                default: 1,
                description: "Page number for pagination (starts from 1). Each page contains up to itemsPerPage items.",
            },
            itemsPerPage: {
                type: "number",
                default: PAGE_SIZES.TAG,
                maximum: PAGE_SIZES.TAG,
                description: `Number of items to return per page (1-${PAGE_SIZES.TAG}). Default: ${PAGE_SIZES.TAG}.`,
            },
            refresh: {
                type: "boolean",
                default: false,
                description: "Force refresh cache by fetching latest data from API, ignoring cached data.",
            },
        },
        required: ["action", "accountId", "containerId", "workspaceId"],
    },
};
