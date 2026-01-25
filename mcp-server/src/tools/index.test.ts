/**
 * Tools Module Integration Tests
 * 리팩토링된 tools 모듈이 올바르게 동작하는지 통합 검증
 */

import { describe, it, expect } from "vitest";
import {
  registerAllTools,
  handleToolCall,
  allSchemas,
  createTextResult,
  createErrorResult,
  paginateArray,
  PAGE_SIZES,
} from "./index.js";

describe("Tools Module Integration", () => {
  describe("registerAllTools", () => {
    it("should return all 22 tool schemas", () => {
      const tools = registerAllTools();

      expect(tools).toHaveLength(22);
    });

    it("should return same array as allSchemas", () => {
      const tools = registerAllTools();

      expect(tools).toBe(allSchemas);
    });

    it("each tool should have name, description, and inputSchema", () => {
      const tools = registerAllTools();

      tools.forEach((tool) => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.inputSchema).toBe("object");
      });
    });

    it("all tool names should be unique", () => {
      const tools = registerAllTools();
      const names = tools.map((t) => t.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    it("all tool names should start with 'gtm_'", () => {
      const tools = registerAllTools();

      tools.forEach((tool) => {
        expect(tool.name.startsWith("gtm_")).toBe(true);
      });
    });
  });

  describe("handleToolCall", () => {
    it("should be a function", () => {
      expect(typeof handleToolCall).toBe("function");
    });

    it("should return ToolResult structure", async () => {
      const result = await handleToolCall("gtm_context", { action: "get" });

      expect(result).toHaveProperty("content");
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty("type", "text");
      expect(result.content[0]).toHaveProperty("text");
    });

    it("should handle all registered tools", async () => {
      const tools = registerAllTools();

      for (const tool of tools) {
        // Just verify routing works - actual API calls will fail without credentials
        // but error should contain tool name
        const result = await handleToolCall(tool.name, {});
        expect(result).toHaveProperty("content");
      }
    });
  });

  describe("Re-exported utilities", () => {
    it("should export createTextResult", () => {
      expect(typeof createTextResult).toBe("function");
      const result = createTextResult({ test: true });
      expect(result.content[0].type).toBe("text");
    });

    it("should export createErrorResult", () => {
      expect(typeof createErrorResult).toBe("function");
      const result = createErrorResult("Test error");
      const content = JSON.parse(result.content[0].text);
      expect(content.error).toBe("Test error");
    });

    it("should export paginateArray", () => {
      expect(typeof paginateArray).toBe("function");
      const result = paginateArray([1, 2, 3, 4, 5], 1, 2);
      expect(result.data).toEqual([1, 2]);
      expect(result.pagination.totalItems).toBe(5);
    });

    it("should export PAGE_SIZES", () => {
      expect(PAGE_SIZES).toBeDefined();
      expect(PAGE_SIZES.TAG).toBe(20);
      expect(PAGE_SIZES.DEFAULT).toBe(50);
    });
  });

  describe("Tool schema to handler mapping", () => {
    it("every schema should have a corresponding handler", async () => {
      const tools = registerAllTools();

      for (const tool of tools) {
        // Call each tool and verify it doesn't return "Unknown tool" error
        const result = await handleToolCall(tool.name, {});
        const content = result.content[0].text;

        // Should not contain "Unknown tool" error
        expect(content).not.toContain("Unknown tool:");
      }
    });
  });
});

describe("Backward Compatibility", () => {
  it("should maintain same API as before refactoring", () => {
    // registerAllTools should return array of schemas
    const tools = registerAllTools();
    expect(Array.isArray(tools)).toBe(true);

    // Each schema should have MCP-compatible structure
    tools.forEach((tool) => {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema).toHaveProperty("properties");
      expect(tool.inputSchema).toHaveProperty("required");
    });
  });

  it("handleToolCall should return MCP-compatible response", async () => {
    const result = await handleToolCall("gtm_context", { action: "get" });

    // MCP expects { content: [{ type: "text", text: "..." }] }
    expect(result).toHaveProperty("content");
    expect(result.content[0]).toHaveProperty("type", "text");
    expect(typeof result.content[0].text).toBe("string");
  });
});
