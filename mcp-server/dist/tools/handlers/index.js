/**
 * Tool Handlers Index
 * 모든 GTM Tool Handler를 통합하고 라우팅
 */
import { createTextResult, createErrorResult } from "../types.js";
import { withAuthRetry, clearCachedClient, log } from "../../utils/index.js";
import { clearSessionContext } from "../../session/index.js";
import { clearAllCache } from "../../utils/file-cache.js";
// Import all handlers
import { handleGtmContext } from "./context.handler.js";
import { handleGtmAccount } from "./account.handler.js";
import { handleGtmContainer } from "./container.handler.js";
import { handleGtmWorkspace } from "./workspace.handler.js";
import { handleGtmTag } from "./tag.handler.js";
import { handleGtmTrigger } from "./trigger.handler.js";
import { handleGtmVariable } from "./variable.handler.js";
import { handleGtmVersion } from "./version.handler.js";
import { handleGtmBuiltInVariable } from "./built-in-variable.handler.js";
import { handleGtmClient } from "./client.handler.js";
import { handleGtmDestination } from "./destination.handler.js";
import { handleGtmEnvironment } from "./environment.handler.js";
import { handleGtmFolder } from "./folder.handler.js";
import { handleGtmGtagConfig } from "./gtag-config.handler.js";
import { handleGtmTemplate } from "./template.handler.js";
import { handleGtmTransformation } from "./transformation.handler.js";
import { handleGtmUserPermission } from "./user-permission.handler.js";
import { handleGtmVersionHeader } from "./version-header.handler.js";
import { handleGtmZone } from "./zone.handler.js";
import { handleGtmExportFull } from "./export.handler.js";
import { handleGtmCache } from "./cache.handler.js";
const handlers = {
    gtm_context: handleGtmContext,
    gtm_account: handleGtmAccount,
    gtm_container: handleGtmContainer,
    gtm_workspace: handleGtmWorkspace,
    gtm_tag: handleGtmTag,
    gtm_trigger: handleGtmTrigger,
    gtm_variable: handleGtmVariable,
    gtm_version: handleGtmVersion,
    gtm_built_in_variable: handleGtmBuiltInVariable,
    gtm_client: handleGtmClient,
    gtm_destination: handleGtmDestination,
    gtm_environment: handleGtmEnvironment,
    gtm_folder: handleGtmFolder,
    gtm_gtag_config: handleGtmGtagConfig,
    gtm_template: handleGtmTemplate,
    gtm_transformation: handleGtmTransformation,
    gtm_user_permission: handleGtmUserPermission,
    gtm_version_header: handleGtmVersionHeader,
    gtm_zone: handleGtmZone,
    gtm_export_full: handleGtmExportFull,
    gtm_cache: handleGtmCache,
};
// ==================== Special Handler ====================
const handleGtmRemoveSession = async (_tagmanager, _args) => {
    clearSessionContext();
    clearCachedClient();
    clearAllCache();
    return createTextResult({
        success: true,
        message: "Session context, auth client, and all caches cleared. New token will be loaded on next API call.",
    });
};
// ==================== Main Router ====================
export const handleToolCall = async (name, args) => {
    log(`Tool call: ${name}`, JSON.stringify(args));
    try {
        // Special case: gtm_remove_session doesn't need tagmanager client
        if (name === "gtm_remove_session") {
            return await handleGtmRemoveSession(null, args);
        }
        // Check if handler exists first
        const handler = handlers[name];
        if (!handler) {
            throw new Error(`Unknown tool: ${name}`);
        }
        // Use withAuthRetry for automatic token refresh and retry on auth failures
        return await withAuthRetry(async (tagmanager) => {
            return await handler(tagmanager, args);
        });
    }
    catch (error) {
        log(`Error in ${name}:`, error);
        return createErrorResult(`Error in ${name}`, error);
    }
};
// ==================== Exports ====================
export { handleGtmContext, handleGtmAccount, handleGtmContainer, handleGtmWorkspace, handleGtmTag, handleGtmTrigger, handleGtmVariable, handleGtmVersion, handleGtmBuiltInVariable, handleGtmClient, handleGtmDestination, handleGtmEnvironment, handleGtmFolder, handleGtmGtagConfig, handleGtmTemplate, handleGtmTransformation, handleGtmUserPermission, handleGtmVersionHeader, handleGtmZone, handleGtmExportFull, handleGtmCache, };
