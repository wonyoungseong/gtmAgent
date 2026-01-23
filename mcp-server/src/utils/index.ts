export {
  getTagManagerClient,
  getCredentialsInfo,
  getAuthType,
  performOAuth2Flow,
  saveAccessToken,
  clearCachedClient,
  CONFIG_DIR,
  OAUTH2_CREDENTIALS_PATH,
  OAUTH2_TOKEN_PATH,
  SERVICE_ACCOUNT_PATH,
  ACCESS_TOKEN_PATH,
  SCOPES
} from "./auth.js";

export {
  getFromFileCache,
  setToFileCache,
  getPageFromFileCache,
  invalidateFileCache,
  invalidateWorkspaceFileCache,
  cleanExpiredFileCache,
  getFileCacheStats,
  getFromFileCacheWithValidation,
  getCachedFingerprint,
  // Fingerprint cache
  getCachedWorkspaceFingerprint,
  setCachedWorkspaceFingerprint,
  clearFingerprintCache,
  // Full cache clear
  clearAllWorkspaceCache,
  clearAllCache
} from "./file-cache.js";

export type { CacheValidationResult } from "./file-cache.js";

export function createErrorResponse(message: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[GTM MCP Error] ${message}: ${errorMessage}`);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            error: true,
            message: message,
            details: errorMessage,
          },
          null,
          2
        ),
      },
    ],
  };
}

export function log(message: string, ...args: unknown[]) {
  console.error(`[GTM MCP] ${message}`, ...args);
}
