import { google } from "googleapis";
type TagManagerClient = ReturnType<typeof google.tagmanager>;
export declare function getTagManagerClient(): Promise<TagManagerClient>;
export declare function getCredentialsInfo(): {
    email: string;
    projectId: string;
} | null;
export {};
