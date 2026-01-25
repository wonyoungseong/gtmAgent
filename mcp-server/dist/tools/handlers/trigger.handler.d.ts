/**
 * GTM Trigger Handler
 */
import { tagmanager_v2 } from "googleapis";
import { ToolResult } from "../types.js";
export declare const handleGtmTrigger: (tagmanager: tagmanager_v2.Tagmanager, args: Record<string, unknown>) => Promise<ToolResult>;
