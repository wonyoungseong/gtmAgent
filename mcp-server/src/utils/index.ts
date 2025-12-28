export { getTagManagerClient, getCredentialsInfo } from "./auth.js";

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
