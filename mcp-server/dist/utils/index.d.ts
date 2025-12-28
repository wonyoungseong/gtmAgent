export { getTagManagerClient, getCredentialsInfo } from "./auth.js";
export declare function createErrorResponse(message: string, error: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function log(message: string, ...args: unknown[]): void;
