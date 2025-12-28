export { getTagManagerClient, getCredentialsInfo } from "./auth.js";
export function createErrorResponse(message, error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GTM MCP Error] ${message}: ${errorMessage}`);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    error: true,
                    message: message,
                    details: errorMessage,
                }, null, 2),
            },
        ],
    };
}
export function log(message, ...args) {
    console.error(`[GTM MCP] ${message}`, ...args);
}
