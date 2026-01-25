#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { getCredentialsInfo, log, cleanExpiredFileCache } from "./utils/index.js";
import { registerAllTools, handleToolCall } from "./tools/index.js";
const server = new Server({
    name: "gtm-mcp-service-account",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = registerAllTools();
    return { tools };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    // ToolResult is compatible with MCP's expected response format
    return await handleToolCall(name, args || {});
});
// Start the server
async function main() {
    // Clean expired cache files on startup
    cleanExpiredFileCache();
    const credInfo = getCredentialsInfo();
    if (credInfo) {
        log(`Starting GTM MCP Server (Service Account: ${credInfo.email})`);
    }
    else {
        log("Starting GTM MCP Server (credentials will be loaded on first API call)");
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("Server connected via stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
