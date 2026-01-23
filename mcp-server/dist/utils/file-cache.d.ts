/**
 * File-based caching for GTM MCP Server
 *
 * Stores list results in files to:
 * - Persist cache across server restarts
 * - Reduce MCP response size by returning only requested page
 * - Avoid token limit errors on large data sets
 * - Validate cache freshness using workspace fingerprint
 */
import { PaginationResult } from "./pagination.js";
/**
 * Get cached workspace fingerprint (in-memory, fast)
 * @returns Cached fingerprint or null if not found/expired
 */
export declare function getCachedWorkspaceFingerprint(accountId: string, containerId: string, workspaceId: string): string | null;
/**
 * Set workspace fingerprint in cache
 */
export declare function setCachedWorkspaceFingerprint(accountId: string, containerId: string, workspaceId: string, fingerprint: string): void;
/**
 * Clear fingerprint cache for a workspace
 */
export declare function clearFingerprintCache(accountId: string, containerId: string, workspaceId: string): void;
/**
 * Clear all fingerprint caches
 */
export declare function clearAllFingerprintCache(): void;
/**
 * Cache validation result
 */
export interface CacheValidationResult<T> {
    valid: boolean;
    data: T[] | null;
    reason?: "hit" | "miss" | "expired" | "fingerprint_mismatch";
}
/**
 * Generate cache file name
 * @example getFileCacheFileName("6277920445", "210926331", "39", "tag")
 *          → "6277920445_210926331_39_tag.json"
 */
export declare function getFileCacheFileName(accountId: string, containerId: string, workspaceId: string, entityType: string): string;
/**
 * Get cached fingerprint from file (without loading full data)
 * @returns Cached fingerprint or null if cache doesn't exist
 */
export declare function getCachedFingerprint(accountId: string, containerId: string, workspaceId: string, entityType: string): string | null;
/**
 * Get data from file cache with fingerprint validation
 * @param currentFingerprint - Current workspace fingerprint to validate against
 * @returns Validation result with data if valid
 */
export declare function getFromFileCacheWithValidation<T>(accountId: string, containerId: string, workspaceId: string, entityType: string, currentFingerprint?: string): CacheValidationResult<T>;
/**
 * Get data from file cache (simple version without fingerprint check)
 * @returns Cached data or null if not found/expired
 */
export declare function getFromFileCache<T>(accountId: string, containerId: string, workspaceId: string, entityType: string): T[] | null;
/**
 * Save data to file cache with workspace fingerprint
 */
export declare function setToFileCache<T>(accountId: string, containerId: string, workspaceId: string, entityType: string, data: T[], workspaceFingerprint?: string): void;
/**
 * Get paginated data from file cache
 * @returns Paginated result or null if cache miss
 */
export declare function getPageFromFileCache<T>(accountId: string, containerId: string, workspaceId: string, entityType: string, page?: number, itemsPerPage?: number): PaginationResult<T> | null;
/**
 * Invalidate (delete) cache file
 * Call after create, update, remove actions
 */
export declare function invalidateFileCache(accountId: string, containerId: string, workspaceId: string, entityType: string): void;
/**
 * Invalidate all cache files for a workspace
 */
export declare function invalidateWorkspaceFileCache(accountId: string, containerId: string, workspaceId: string): void;
/**
 * Clear ALL caches for a workspace (file cache + fingerprint cache)
 * Use this for manual cache reset
 */
export declare function clearAllWorkspaceCache(accountId: string, containerId: string, workspaceId: string): {
    filesDeleted: number;
    fingerprintCleared: boolean;
};
/**
 * Clear ALL caches (all workspaces)
 * Use this for complete cache reset
 */
export declare function clearAllCache(): {
    filesDeleted: number;
    fingerprintsCleared: number;
};
/**
 * Clean expired cache files
 * Call on server startup
 */
export declare function cleanExpiredFileCache(): void;
/**
 * Get cache statistics (for debugging)
 */
export declare function getFileCacheStats(): {
    totalFiles: number;
    files: string[];
    fingerprintCacheSize: number;
};
