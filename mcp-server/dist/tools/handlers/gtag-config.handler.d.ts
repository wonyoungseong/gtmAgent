/**
 * GTM Gtag Config Handler
 */
import { tagmanager_v2 } from "googleapis";
import { ToolResult } from "../types.js";
export declare const handleGtmGtagConfig: (tagmanager: tagmanager_v2.Tagmanager, args: Record<string, unknown>) => Promise<ToolResult>;
