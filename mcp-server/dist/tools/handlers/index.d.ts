/**
 * Tool Handlers Index
 * 모든 GTM Tool Handler를 통합하고 라우팅
 */
import { ToolResult } from "../types.js";
import { handleGtmContext } from "./context.handler.js";
import { handleGtmAccount } from "./account.handler.js";
import { handleGtmContainer } from "./container.handler.js";
import { handleGtmWorkspace } from "./workspace.handler.js";
import { handleGtmTag } from "./tag.handler.js";
import { handleGtmTrigger } from "./trigger.handler.js";
import { handleGtmVariable } from "./variable.handler.js";
import { handleGtmVersion } from "./version.handler.js";
import { handleGtmBuiltInVariable } from "./built-in-variable.handler.js";
import { handleGtmClient } from "./client.handler.js";
import { handleGtmDestination } from "./destination.handler.js";
import { handleGtmEnvironment } from "./environment.handler.js";
import { handleGtmFolder } from "./folder.handler.js";
import { handleGtmGtagConfig } from "./gtag-config.handler.js";
import { handleGtmTemplate } from "./template.handler.js";
import { handleGtmTransformation } from "./transformation.handler.js";
import { handleGtmUserPermission } from "./user-permission.handler.js";
import { handleGtmVersionHeader } from "./version-header.handler.js";
import { handleGtmZone } from "./zone.handler.js";
import { handleGtmExportFull } from "./export.handler.js";
import { handleGtmCache } from "./cache.handler.js";
export declare const handleToolCall: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
export { handleGtmContext, handleGtmAccount, handleGtmContainer, handleGtmWorkspace, handleGtmTag, handleGtmTrigger, handleGtmVariable, handleGtmVersion, handleGtmBuiltInVariable, handleGtmClient, handleGtmDestination, handleGtmEnvironment, handleGtmFolder, handleGtmGtagConfig, handleGtmTemplate, handleGtmTransformation, handleGtmUserPermission, handleGtmVersionHeader, handleGtmZone, handleGtmExportFull, handleGtmCache, };
