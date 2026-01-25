/**
 * GTM Account Handler
 */
import { createTextResult } from "../types.js";
export const handleGtmAccount = async (tagmanager, args) => {
    const action = args.action;
    const accountId = args.accountId;
    switch (action) {
        case "list": {
            const response = await tagmanager.accounts.list({});
            return createTextResult(response.data);
        }
        case "get": {
            if (!accountId)
                throw new Error("accountId is required for get action");
            const response = await tagmanager.accounts.get({
                path: `accounts/${accountId}`,
            });
            return createTextResult(response.data);
        }
        case "update": {
            if (!accountId)
                throw new Error("accountId is required for update action");
            const config = args.config;
            if (!config)
                throw new Error("config is required for update action");
            const response = await tagmanager.accounts.update({
                path: `accounts/${accountId}`,
                requestBody: config,
            });
            return createTextResult(response.data);
        }
        default:
            throw new Error(`Unknown action: ${action}`);
    }
};
