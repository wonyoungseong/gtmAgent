export { getTagManagerClient, getCredentialsInfo, getAuthType, performOAuth2Flow, saveAccessToken, clearCachedClient, CONFIG_DIR, OAUTH2_CREDENTIALS_PATH, OAUTH2_TOKEN_PATH, SERVICE_ACCOUNT_PATH, ACCESS_TOKEN_PATH, SCOPES } from "./auth.js";
export { getFromFileCache, setToFileCache, getPageFromFileCache, invalidateFileCache, invalidateWorkspaceFileCache, cleanExpiredFileCache, getFileCacheStats, getFromFileCacheWithValidation, getCachedFingerprint, getCachedWorkspaceFingerprint, setCachedWorkspaceFingerprint, clearFingerprintCache, clearAllWorkspaceCache, clearAllCache } from "./file-cache.js";
export type { CacheValidationResult } from "./file-cache.js";
export declare function createErrorResponse(message: string, error: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function log(message: string, ...args: unknown[]): void;
