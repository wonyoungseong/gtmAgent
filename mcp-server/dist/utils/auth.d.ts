import { google } from "googleapis";
type TagManagerClient = ReturnType<typeof google.tagmanager>;
interface AccessTokenData {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
    client_id?: string;
    client_secret?: string;
}
declare const CONFIG_DIR: string;
declare const SERVICE_ACCOUNT_PATH: string;
declare const OAUTH2_CREDENTIALS_PATH: string;
declare const OAUTH2_TOKEN_PATH: string;
declare const ACCESS_TOKEN_PATH: string;
declare const ACCESS_TOKEN_JSON_PATH: string;
declare const SCOPES: string[];
export declare function saveAccessToken(token: string): void;
export declare function saveAccessTokenData(data: AccessTokenData): void;
/**
 * Get TagManager client with automatic token validation and refresh
 * This is the main entry point for getting an authenticated client
 */
export declare function getTagManagerClient(): Promise<TagManagerClient>;
/**
 * Clear cached client and force re-authentication on next call
 */
export declare function clearCachedClient(): void;
/**
 * Wrapper for API calls with automatic retry on auth failure
 */
export declare function withAuthRetry<T>(operation: (client: TagManagerClient) => Promise<T>, maxRetries?: number): Promise<T>;
export declare function getCredentialsInfo(): {
    email: string;
    projectId: string;
    type: string;
} | null;
export declare function getAuthType(): string | null;
export declare function performOAuth2Flow(): Promise<boolean>;
export { CONFIG_DIR, OAUTH2_CREDENTIALS_PATH, OAUTH2_TOKEN_PATH, SERVICE_ACCOUNT_PATH, ACCESS_TOKEN_PATH, ACCESS_TOKEN_JSON_PATH, SCOPES };
