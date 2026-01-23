import { google } from "googleapis";
type TagManagerClient = ReturnType<typeof google.tagmanager>;
declare const CONFIG_DIR: string;
declare const SERVICE_ACCOUNT_PATH: string;
declare const OAUTH2_CREDENTIALS_PATH: string;
declare const OAUTH2_TOKEN_PATH: string;
declare const ACCESS_TOKEN_PATH: string;
declare const SCOPES: string[];
export declare function saveAccessToken(token: string): void;
export declare function getTagManagerClient(): Promise<TagManagerClient>;
export declare function clearCachedClient(): void;
export declare function getCredentialsInfo(): {
    email: string;
    projectId: string;
    type: string;
} | null;
export declare function getAuthType(): string | null;
export declare function performOAuth2Flow(): Promise<boolean>;
export { CONFIG_DIR, OAUTH2_CREDENTIALS_PATH, OAUTH2_TOKEN_PATH, SERVICE_ACCOUNT_PATH, ACCESS_TOKEN_PATH, SCOPES };
