/**
 * GTM MCP Server - Tools Module
 *
 * 리팩토링된 구조:
 * - schemas/: Tool 정의 (InputSchema)
 * - handlers/: Tool 실행 로직
 * - types.ts: 공통 타입 정의
 *
 * 기존 1800+ 라인 → ~30 라인으로 축소
 */
import { allSchemas } from "./schemas/index.js";
import { handleToolCall } from "./handlers/index.js";
export declare const registerAllTools: () => import("./types.js").ToolSchema[];
export { handleToolCall };
export { allSchemas };
export * from "./types.js";
