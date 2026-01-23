/**
 * File-based caching for GTM MCP Server
 *
 * Stores list results in files to:
 * - Persist cache across server restarts
 * - Reduce MCP response size by returning only requested page
 * - Avoid token limit errors on large data sets
 * - Validate cache freshness using workspace fingerprint
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { paginateArray, DEFAULT_PAGE_SIZE, CACHE_TTL_MS } from "./pagination.js";
// Cache directory under ~/.gtm-mcp/cache/
const CONFIG_DIR = join(homedir(), ".gtm-mcp");
const CACHE_DIR = join(CONFIG_DIR, "cache");
// Fingerprint cache TTL (1 minute) - shorter than data cache
const FINGERPRINT_CACHE_TTL_MS = 60 * 1000;
// In-memory cache for workspace fingerprints (fast lookup, no API call needed)
const fingerprintCache = new Map();
/**
 * Get fingerprint cache key
 */
function getFingerprintCacheKey(accountId, containerId, workspaceId) {
    return `${accountId}/${containerId}/${workspaceId}`;
}
/**
 * Get cached workspace fingerprint (in-memory, fast)
 * @returns Cached fingerprint or null if not found/expired
 */
export function getCachedWorkspaceFingerprint(accountId, containerId, workspaceId) {
    const key = getFingerprintCacheKey(accountId, containerId, workspaceId);
    const entry = fingerprintCache.get(key);
    if (!entry) {
        return null;
    }
    // Check TTL
    if (Date.now() - entry.timestamp > FINGERPRINT_CACHE_TTL_MS) {
        fingerprintCache.delete(key);
        console.error(`[FingerprintCache] Expired for workspace ${workspaceId}`);
        return null;
    }
    console.error(`[FingerprintCache] Hit for workspace ${workspaceId}: ${entry.fingerprint}`);
    return entry.fingerprint;
}
/**
 * Set workspace fingerprint in cache
 */
export function setCachedWorkspaceFingerprint(accountId, containerId, workspaceId, fingerprint) {
    const key = getFingerprintCacheKey(accountId, containerId, workspaceId);
    fingerprintCache.set(key, {
        fingerprint,
        timestamp: Date.now(),
    });
    console.error(`[FingerprintCache] Saved for workspace ${workspaceId}: ${fingerprint}`);
}
/**
 * Clear fingerprint cache for a workspace
 */
export function clearFingerprintCache(accountId, containerId, workspaceId) {
    const key = getFingerprintCacheKey(accountId, containerId, workspaceId);
    fingerprintCache.delete(key);
    console.error(`[FingerprintCache] Cleared for workspace ${workspaceId}`);
}
/**
 * Clear all fingerprint caches
 */
export function clearAllFingerprintCache() {
    const size = fingerprintCache.size;
    fingerprintCache.clear();
    console.error(`[FingerprintCache] Cleared all (${size} entries)`);
}
// ==================== File Cache ====================
// Ensure cache directory exists
function ensureCacheDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true });
    }
}
/**
 * Generate cache file name
 * @example getFileCacheFileName("6277920445", "210926331", "39", "tag")
 *          → "6277920445_210926331_39_tag.json"
 */
export function getFileCacheFileName(accountId, containerId, workspaceId, entityType) {
    return `${accountId}_${containerId}_${workspaceId}_${entityType}.json`;
}
/**
 * Get full file path for cache
 */
function getCacheFilePath(accountId, containerId, workspaceId, entityType) {
    ensureCacheDir();
    return join(CACHE_DIR, getFileCacheFileName(accountId, containerId, workspaceId, entityType));
}
/**
 * Get cached fingerprint from file (without loading full data)
 * @returns Cached fingerprint or null if cache doesn't exist
 */
export function getCachedFingerprint(accountId, containerId, workspaceId, entityType) {
    const filePath = getCacheFilePath(accountId, containerId, workspaceId, entityType);
    if (!existsSync(filePath)) {
        return null;
    }
    try {
        const content = readFileSync(filePath, "utf-8");
        const entry = JSON.parse(content);
        return entry.workspaceFingerprint || null;
    }
    catch {
        return null;
    }
}
/**
 * Get data from file cache with fingerprint validation
 * @param currentFingerprint - Current workspace fingerprint to validate against
 * @returns Validation result with data if valid
 */
export function getFromFileCacheWithValidation(accountId, containerId, workspaceId, entityType, currentFingerprint) {
    const filePath = getCacheFilePath(accountId, containerId, workspaceId, entityType);
    if (!existsSync(filePath)) {
        return { valid: false, data: null, reason: "miss" };
    }
    try {
        const content = readFileSync(filePath, "utf-8");
        const entry = JSON.parse(content);
        // Check TTL
        if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
            try {
                unlinkSync(filePath);
            }
            catch {
                // Ignore deletion errors
            }
            console.error(`[FileCache] Cache expired for ${entityType}, deleted`);
            return { valid: false, data: null, reason: "expired" };
        }
        // Check fingerprint if provided
        if (currentFingerprint && entry.workspaceFingerprint) {
            if (entry.workspaceFingerprint !== currentFingerprint) {
                try {
                    unlinkSync(filePath);
                }
                catch {
                    // Ignore deletion errors
                }
                console.error(`[FileCache] Fingerprint mismatch for ${entityType} (cached: ${entry.workspaceFingerprint}, current: ${currentFingerprint}), cache invalidated`);
                return { valid: false, data: null, reason: "fingerprint_mismatch" };
            }
        }
        console.error(`[FileCache] Cache hit for ${entityType}: ${entry.totalItems} items (fingerprint: ${entry.workspaceFingerprint || 'none'})`);
        return { valid: true, data: entry.data, reason: "hit" };
    }
    catch (error) {
        console.error(`[FileCache] Error reading cache file: ${error}`);
        return { valid: false, data: null, reason: "miss" };
    }
}
/**
 * Get data from file cache (simple version without fingerprint check)
 * @returns Cached data or null if not found/expired
 */
export function getFromFileCache(accountId, containerId, workspaceId, entityType) {
    const result = getFromFileCacheWithValidation(accountId, containerId, workspaceId, entityType);
    return result.data;
}
/**
 * Save data to file cache with workspace fingerprint
 */
export function setToFileCache(accountId, containerId, workspaceId, entityType, data, workspaceFingerprint) {
    const filePath = getCacheFilePath(accountId, containerId, workspaceId, entityType);
    const entry = {
        data,
        timestamp: Date.now(),
        totalItems: data.length,
        entityType,
        workspaceFingerprint,
    };
    try {
        writeFileSync(filePath, JSON.stringify(entry), "utf-8");
        console.error(`[FileCache] Cache saved for ${entityType}: ${data.length} items (fingerprint: ${workspaceFingerprint || 'none'})`);
    }
    catch (error) {
        console.error(`[FileCache] Error writing cache file: ${error}`);
    }
}
/**
 * Get paginated data from file cache
 * @returns Paginated result or null if cache miss
 */
export function getPageFromFileCache(accountId, containerId, workspaceId, entityType, page = 1, itemsPerPage = DEFAULT_PAGE_SIZE) {
    const data = getFromFileCache(accountId, containerId, workspaceId, entityType);
    if (!data) {
        return null;
    }
    return paginateArray(data, page, itemsPerPage);
}
/**
 * Invalidate (delete) cache file
 * Call after create, update, remove actions
 */
export function invalidateFileCache(accountId, containerId, workspaceId, entityType) {
    const filePath = getCacheFilePath(accountId, containerId, workspaceId, entityType);
    if (existsSync(filePath)) {
        try {
            unlinkSync(filePath);
            console.error(`[FileCache] Cache invalidated for ${entityType}`);
        }
        catch (error) {
            console.error(`[FileCache] Error deleting cache file: ${error}`);
        }
    }
}
/**
 * Invalidate all cache files for a workspace
 */
export function invalidateWorkspaceFileCache(accountId, containerId, workspaceId) {
    ensureCacheDir();
    const prefix = `${accountId}_${containerId}_${workspaceId}_`;
    try {
        const files = readdirSync(CACHE_DIR);
        for (const file of files) {
            if (file.startsWith(prefix) && file.endsWith(".json")) {
                const filePath = join(CACHE_DIR, file);
                unlinkSync(filePath);
                console.error(`[FileCache] Deleted: ${file}`);
            }
        }
    }
    catch (error) {
        console.error(`[FileCache] Error invalidating workspace cache: ${error}`);
    }
}
/**
 * Clear ALL caches for a workspace (file cache + fingerprint cache)
 * Use this for manual cache reset
 */
export function clearAllWorkspaceCache(accountId, containerId, workspaceId) {
    let filesDeleted = 0;
    // Clear file cache
    ensureCacheDir();
    const prefix = `${accountId}_${containerId}_${workspaceId}_`;
    try {
        const files = readdirSync(CACHE_DIR);
        for (const file of files) {
            if (file.startsWith(prefix) && file.endsWith(".json")) {
                const filePath = join(CACHE_DIR, file);
                unlinkSync(filePath);
                filesDeleted++;
            }
        }
    }
    catch (error) {
        console.error(`[Cache] Error clearing file cache: ${error}`);
    }
    // Clear fingerprint cache
    clearFingerprintCache(accountId, containerId, workspaceId);
    console.error(`[Cache] Cleared all cache for workspace ${workspaceId}: ${filesDeleted} files deleted`);
    return { filesDeleted, fingerprintCleared: true };
}
/**
 * Clear ALL caches (all workspaces)
 * Use this for complete cache reset
 */
export function clearAllCache() {
    let filesDeleted = 0;
    // Clear all file cache
    ensureCacheDir();
    try {
        const files = readdirSync(CACHE_DIR);
        for (const file of files) {
            if (file.endsWith(".json")) {
                const filePath = join(CACHE_DIR, file);
                unlinkSync(filePath);
                filesDeleted++;
            }
        }
    }
    catch (error) {
        console.error(`[Cache] Error clearing file cache: ${error}`);
    }
    // Clear all fingerprint cache
    const fingerprintsCleared = fingerprintCache.size;
    clearAllFingerprintCache();
    console.error(`[Cache] Cleared ALL cache: ${filesDeleted} files, ${fingerprintsCleared} fingerprints`);
    return { filesDeleted, fingerprintsCleared };
}
/**
 * Clean expired cache files
 * Call on server startup
 */
export function cleanExpiredFileCache() {
    ensureCacheDir();
    let cleaned = 0;
    let total = 0;
    try {
        const files = readdirSync(CACHE_DIR);
        for (const file of files) {
            if (!file.endsWith(".json"))
                continue;
            total++;
            const filePath = join(CACHE_DIR, file);
            try {
                const content = readFileSync(filePath, "utf-8");
                const entry = JSON.parse(content);
                if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
                    unlinkSync(filePath);
                    cleaned++;
                }
            }
            catch {
                // Invalid file, delete it
                try {
                    unlinkSync(filePath);
                    cleaned++;
                }
                catch {
                    // Ignore
                }
            }
        }
        if (cleaned > 0) {
            console.error(`[FileCache] Cleaned ${cleaned}/${total} expired cache files`);
        }
        else {
            console.error(`[FileCache] No expired cache files to clean (${total} files)`);
        }
    }
    catch (error) {
        console.error(`[FileCache] Error cleaning cache: ${error}`);
    }
}
/**
 * Get cache statistics (for debugging)
 */
export function getFileCacheStats() {
    ensureCacheDir();
    try {
        const files = readdirSync(CACHE_DIR).filter(f => f.endsWith(".json"));
        return {
            totalFiles: files.length,
            files,
            fingerprintCacheSize: fingerprintCache.size,
        };
    }
    catch {
        return { totalFiles: 0, files: [], fingerprintCacheSize: fingerprintCache.size };
    }
}
