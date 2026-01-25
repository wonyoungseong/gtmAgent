/**
 * GTM Context Handler
 * 세션 컨텍스트 관리
 */
import { tagmanager_v2 } from "googleapis";
import { ToolResult } from "../types.js";
export declare const handleGtmContext: (tagmanager: tagmanager_v2.Tagmanager, args: Record<string, unknown>) => Promise<ToolResult>;
