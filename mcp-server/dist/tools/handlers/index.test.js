/**
 * Handlers Index Tests
 * 핸들러 라우팅과 export가 올바르게 되는지 검증
 */
import { describe, it, expect } from "vitest";
import { handleToolCall, handleGtmContext, handleGtmAccount, handleGtmContainer, handleGtmWorkspace, handleGtmTag, handleGtmTrigger, handleGtmVariable, handleGtmVersion, handleGtmBuiltInVariable, handleGtmClient, handleGtmDestination, handleGtmEnvironment, handleGtmFolder, handleGtmGtagConfig, handleGtmTemplate, handleGtmTransformation, handleGtmUserPermission, handleGtmVersionHeader, handleGtmZone, handleGtmExportFull, handleGtmCache, } from "./index.js";
describe("Handlers Module", () => {
    describe("Handler exports", () => {
        it("should export handleToolCall function", () => {
            expect(typeof handleToolCall).toBe("function");
        });
        it("should export all individual handlers", () => {
            expect(typeof handleGtmContext).toBe("function");
            expect(typeof handleGtmAccount).toBe("function");
            expect(typeof handleGtmContainer).toBe("function");
            expect(typeof handleGtmWorkspace).toBe("function");
            expect(typeof handleGtmTag).toBe("function");
            expect(typeof handleGtmTrigger).toBe("function");
            expect(typeof handleGtmVariable).toBe("function");
            expect(typeof handleGtmVersion).toBe("function");
            expect(typeof handleGtmBuiltInVariable).toBe("function");
            expect(typeof handleGtmClient).toBe("function");
            expect(typeof handleGtmDestination).toBe("function");
            expect(typeof handleGtmEnvironment).toBe("function");
            expect(typeof handleGtmFolder).toBe("function");
            expect(typeof handleGtmGtagConfig).toBe("function");
            expect(typeof handleGtmTemplate).toBe("function");
            expect(typeof handleGtmTransformation).toBe("function");
            expect(typeof handleGtmUserPermission).toBe("function");
            expect(typeof handleGtmVersionHeader).toBe("function");
            expect(typeof handleGtmZone).toBe("function");
            expect(typeof handleGtmExportFull).toBe("function");
            expect(typeof handleGtmCache).toBe("function");
        });
    });
    describe("handleToolCall routing", () => {
        it("should handle unknown tool gracefully", async () => {
            const result = await handleToolCall("unknown_tool", {});
            const content = JSON.parse(result.content[0].text);
            expect(content.error).toContain("unknown_tool");
        });
        it("should route gtm_context correctly", async () => {
            // gtm_context with action='get' should work without API call
            const result = await handleToolCall("gtm_context", { action: "get" });
            expect(result).toHaveProperty("content");
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe("text");
        });
        it("should route gtm_context clear action correctly", async () => {
            const result = await handleToolCall("gtm_context", { action: "clear" });
            const content = JSON.parse(result.content[0].text);
            expect(content.success).toBe(true);
            expect(content.message).toContain("초기화");
        });
    });
    describe("Error handling", () => {
        it("should return error result for missing required parameters", async () => {
            // gtm_context set action requires accountId
            const result = await handleToolCall("gtm_context", {
                action: "set",
                // missing accountId
            });
            const content = JSON.parse(result.content[0].text);
            expect(content.error).toBeDefined();
        });
    });
});
