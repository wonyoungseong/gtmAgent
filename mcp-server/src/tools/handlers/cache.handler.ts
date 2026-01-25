/**
 * GTM Cache Handler
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult } from "../types.js";
import {
  clearAllWorkspaceCache,
  clearAllCache,
  getFileCacheStats,
} from "../../utils/file-cache.js";

export const handleGtmCache = async (
  _tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;
  const accountId = args.accountId as string;
  const containerId = args.containerId as string;
  const workspaceId = args.workspaceId as string;

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
