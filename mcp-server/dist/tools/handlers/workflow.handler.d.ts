/**
 * GTM Workflow Handler
 * Agent System WorkflowRunner를 MCP Tool로 노출
 */
import { tagmanager_v2 } from "googleapis";
import { ToolResult } from "../types.js";
export declare const handleGtmWorkflow: (tagmanager: tagmanager_v2.Tagmanager, args: Record<string, unknown>) => Promise<ToolResult>;
