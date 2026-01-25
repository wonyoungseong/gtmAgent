/**
 * GTM Client Handler
 */
import { tagmanager_v2 } from "googleapis";
import { ToolResult } from "../types.js";
export declare const handleGtmClient: (tagmanager: tagmanager_v2.Tagmanager, args: Record<string, unknown>) => Promise<ToolResult>;
