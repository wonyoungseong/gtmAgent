/**
 * GTM Cache Handler
 */
import { createTextResult } from "../types.js";
import { clearAllWorkspaceCache, clearAllCache, getFileCacheStats, } from "../../utils/file-cache.js";
export const handleGtmCache = async (_tagmanager, args) => {
    const action = args.action;
    const accountId = args.accountId;
    const containerId = args.containerId;
    const workspaceId = args.workspaceId;
    switch (action) {
        case "clear": {
            if (!accountId || !containerId || !workspaceId) {
                throw new Error("accountId, containerId, and workspaceId are required for 'clear' action");
            }
            const result = clearAllWorkspaceCache(accountId, containerId, workspaceId);
            return createTextResult({
                success: true,
                message: `Cache cleared for workspace ${workspaceId}`,
                filesDeleted: result.filesDeleted,
                fingerprintCleared: result.fingerprintCleared,
            });
        }
        case "clearAll": {
            const result = clearAllCache();
            return createTextResult({
                success: true,
                message: "All caches cleared",
                filesDeleted: result.filesDeleted,
                fingerprintsCleared: result.fingerprintsCleared,
            });
        }
        case "stats": {
            const stats = getFileCacheStats();
            return createTextResult({
                totalCacheFiles: stats.totalFiles,
                files: stats.files,
                fingerprintCacheEntries: stats.fingerprintCacheSize,
            });
        }
        default:
            throw new Error(`Unknown action: ${action}`);
    }
};
