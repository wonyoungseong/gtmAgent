/**
 * Types Module Tests
 * 공통 타입과 헬퍼 함수들이 올바르게 동작하는지 검증
 */

import { describe, it, expect } from "vitest";
import {
  createTextResult,
  createErrorResult,
  paginateArray,
  PAGE_SIZES,
  ToolResult,
  PaginatedResult,
} from "./types.js";

describe("Types Module", () => {
  describe("createTextResult", () => {
    it("should create a valid ToolResult with text content", () => {
      const data = { message: "Hello, World!" };
      const result = createTextResult(data);

      expect(result).toHaveProperty("content");
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
    });

    it("should handle complex nested objects", () => {
      const data = {
        account: { id: "123", name: "Test Account" },
        containers: [{ id: "456", name: "Container 1" }],
      };
      const result = createTextResult(data);

      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
    });

    it("should handle arrays", () => {
      const data = [1, 2, 3, 4, 5];
      const result = createTextResult(data);

      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
    });

    it("should handle primitive values", () => {
      expect(createTextResult("string").content[0].text).toBe('"string"');
      expect(createTextResult(123).content[0].text).toBe("123");
      expect(createTextResult(true).content[0].text).toBe("true");
      expect(createTextResult(null).content[0].text).toBe("null");
    });
  });

  describe("createErrorResult", () => {
    it("should create an error result with message", () => {
      const result = createErrorResult("Test error");
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.error).toBe("Test error");
      expect(parsed.details).toBe("undefined");
    });

    it("should include Error details", () => {
      const error = new Error("Something went wrong");
      const result = createErrorResult("Operation failed", error);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.error).toBe("Operation failed");
      expect(parsed.details).toBe("Something went wrong");
    });

    it("should handle string errors", () => {
      const result = createErrorResult("Operation failed", "Custom error string");
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.details).toBe("Custom error string");
    });
  });

  describe("paginateArray", () => {
    const testData = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

    it("should return correct page of data", () => {
      const result = paginateArray(testData, 1, 20);

      expect(result.data).toHaveLength(20);
      expect(result.data[0].id).toBe(1);
      expect(result.data[19].id).toBe(20);
    });

    it("should return correct pagination metadata", () => {
      const result = paginateArray(testData, 1, 20);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.itemsPerPage).toBe(20);
      expect(result.pagination.totalItems).toBe(100);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it("should handle middle pages", () => {
      const result = paginateArray(testData, 3, 20);

      expect(result.data[0].id).toBe(41);
      expect(result.data[19].id).toBe(60);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it("should handle last page", () => {
      const result = paginateArray(testData, 5, 20);

      expect(result.data).toHaveLength(20);
      expect(result.data[0].id).toBe(81);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it("should handle partial last page", () => {
      const partialData = Array.from({ length: 55 }, (_, i) => ({ id: i + 1 }));
      const result = paginateArray(partialData, 3, 20);

      expect(result.data).toHaveLength(15); // Only 15 items on last page
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it("should handle empty array", () => {
      const result = paginateArray([], 1, 20);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });
  });

  describe("PAGE_SIZES constants", () => {
    it("should have correct default values", () => {
      expect(PAGE_SIZES.TAG).toBe(20);
      expect(PAGE_SIZES.TRIGGER).toBe(20);
      expect(PAGE_SIZES.VARIABLE).toBe(20);
      expect(PAGE_SIZES.TEMPLATE).toBe(20);
      expect(PAGE_SIZES.ZONE).toBe(20);
      expect(PAGE_SIZES.VERSION).toBe(20);
      expect(PAGE_SIZES.DEFAULT).toBe(50);
    });
  });
});
