/**
 * Other GTM Tool Schemas
 * 빌더 패턴을 사용하여 나머지 GTM Tool 스키마 정의
 */
import { PAGE_SIZES } from "../types.js";
import { createEntitySchema } from "./schema-builder.js";
// ==================== Builder 적용 스키마 ====================
export const gtmVersionSchema = createEntitySchema({
    name: "gtm_version",
    entityName: "container version",
    description: `Performs container version operations: get, live, setLatest, undelete, update. For 'get' and 'live' actions, use 'resourceType' to paginate specific resource arrays (up to ${PAGE_SIZES.VERSION} items per page) to avoid response truncation. NOTE: publish/remove actions are disabled for safety.`,
    hierarchy: "container",
    idField: "containerVersionId",
    idDescription: "The unique ID of the GTM container version. Required for 'get', 'setLatest', 'undelete', and 'update' actions.",
    actions: ["get", "live", "setLatest", "undelete", "update"],
    pageSize: PAGE_SIZES.VERSION,
    includeCrudFields: false,
    extraFields: {
        createOrUpdateConfig: {
            type: "object",
            description: "Configuration for 'update' actions.",
        },
        fingerprint: {
            type: "string",
            description: "The fingerprint for optimistic concurrency control. Required for 'update' actions.",
        },
        resourceType: {
            type: "string",
            enum: ["tag", "trigger", "variable", "folder", "builtInVariable", "zone", "customTemplate", "client", "gtagConfig", "transformation"],
            description: "Specific resource type to retrieve with pagination (only for 'get' and 'live' actions).",
        },
        includeSummary: {
            type: "boolean",
            default: true,
            description: "Include counts and metadata for all resource types.",
        },
    },
});
export const gtmBuiltInVariableSchema = createEntitySchema({
    name: "gtm_built_in_variable",
    entityName: "built-in variable",
    description: "Performs all built-in variable operations: create, list, remove, revert. The 'list' action returns up to itemsPerPage items per page.",
    hierarchy: "workspace",
    actions: ["create", "list", "remove", "revert"],
    pageSize: PAGE_SIZES.DEFAULT,
    includeCrudFields: false,
    extraFields: {
        type: {
            type: "string",
            description: "The built-in variable type. Required for 'revert' and 'remove' actions.",
        },
        types: {
            type: "array",
            items: { type: "string" },
            description: "Array of built-in variable types. Optional for 'list' action.",
        },
        pageToken: {
            type: "string",
            description: "A token for pagination. Optional for 'list' action.",
        },
    },
});
export const gtmClientSchema = createEntitySchema({
    name: "gtm_client",
    entityName: "client",
    description: "Performs all client operations: create, get, list, update, remove, revert. The 'list' action returns up to itemsPerPage items per page.",
    hierarchy: "workspace",
    idField: "clientId",
    idDescription: "The unique ID of the GTM Client. Required for 'get', 'update', 'remove', and 'revert' actions.",
    actions: ["create", "get", "list", "update", "remove", "revert"],
    pageSize: PAGE_SIZES.DEFAULT,
});
export const gtmDestinationSchema = createEntitySchema({
    name: "gtm_destination",
    entityName: "destination",
    description: `Performs all destination operations: get, list, link, unlink.  The 'list' action returns up to ${PAGE_SIZES.DEFAULT} items per page.`,
    hierarchy: "container",
    idField: "destinationId",
    idDescription: "The unique ID of the GTM Destination. Required for 'get', 'link', and 'unlink' actions.",
    actions: ["get", "list", "link", "unlink"],
    pageSize: PAGE_SIZES.DEFAULT,
    includeCrudFields: false,
    extraFields: {
        allowUserPermissionFeatureUpdate: {
            type: "boolean",
            description: "If true, allows user permission feature update during linking.",
        },
    },
});
export const gtmEnvironmentSchema = createEntitySchema({
    name: "gtm_environment",
    entityName: "environment",
    description: `Performs all environment operations: create, get, list, update, remove, reauthorize.  The 'list' action returns up to ${PAGE_SIZES.DEFAULT} items per page.`,
    hierarchy: "container",
    idField: "environmentId",
    idDescription: "The unique ID of the GTM Environment. Required for 'get', 'update', 'remove', and 'reauthorize' actions.",
    actions: ["create", "get", "list", "update", "remove", "reauthorize"],
    pageSize: PAGE_SIZES.DEFAULT,
});
export const gtmFolderSchema = createEntitySchema({
    name: "gtm_folder",
    entityName: "folder",
    description: `Performs all folder operations: create, get, list, update, remove, revert, entities, moveEntitiesToFolder. The 'list' action returns up to ${PAGE_SIZES.DEFAULT} items per page.`,
    hierarchy: "workspace",
    idField: "folderId",
    idDescription: "The unique ID of the GTM Folder.",
    actions: ["create", "get", "list", "update", "remove", "revert", "entities", "moveEntitiesToFolder"],
    pageSize: PAGE_SIZES.DEFAULT,
    extraFields: {
        tagId: {
            type: "array",
            items: { type: "string" },
            description: "The tags to be moved to the folder.",
        },
        triggerId: {
            type: "array",
            items: { type: "string" },
            description: "The triggers to be moved to the folder.",
        },
        variableId: {
            type: "array",
            items: { type: "string" },
            description: "The variables to be moved to the folder.",
        },
    },
});
export const gtmGtagConfigSchema = createEntitySchema({
    name: "gtm_gtag_config",
    entityName: "Google tag config",
    description: "Performs all Google tag config operations: create, get, list, update, remove. The 'list' action returns up to itemsPerPage items per page.",
    hierarchy: "workspace",
    idField: "gtagConfigId",
    idDescription: "The unique ID of the Google tag config. Required for 'get', 'update', and 'remove' actions.",
    actions: ["create", "get", "list", "update", "remove"],
    pageSize: PAGE_SIZES.DEFAULT,
});
export const gtmTemplateSchema = createEntitySchema({
    name: "gtm_template",
    entityName: "custom template",
    description: "Performs all GTM custom template operations: create, get, list, update, remove, revert. The 'list' action returns up to itemsPerPage items per page.",
    hierarchy: "workspace",
    idField: "templateId",
    idDescription: "The unique ID of the GTM custom template. Required for 'get', 'update', 'remove', and 'revert' actions.",
    actions: ["create", "get", "list", "update", "remove", "revert"],
    pageSize: PAGE_SIZES.TEMPLATE,
});
export const gtmTransformationSchema = createEntitySchema({
    name: "gtm_transformation",
    entityName: "transformation",
    description: "Performs all GTM transformation operations: create, get, list, update, remove, revert. The 'list' action returns up to itemsPerPage items per page.",
    hierarchy: "workspace",
    idField: "transformationId",
    idDescription: "The unique ID of the GTM transformation. Required for 'get', 'update', 'remove', and 'revert' actions.",
    actions: ["create", "get", "list", "update", "remove", "revert"],
    pageSize: PAGE_SIZES.DEFAULT,
});
export const gtmUserPermissionSchema = createEntitySchema({
    name: "gtm_user_permission",
    entityName: "user permission",
    description: `Performs all user permission operations: create, get, list, update, remove. The 'list' action returns up to ${PAGE_SIZES.DEFAULT} items per page.`,
    hierarchy: "account",
    idField: "userPermissionId",
    idDescription: "The unique ID of the user permission. Required for 'get', 'update', and 'remove' actions.",
    actions: ["create", "get", "list", "update", "remove"],
    pageSize: PAGE_SIZES.DEFAULT,
    includeCrudFields: false,
    extraFields: {
        createOrUpdateConfig: {
            type: "object",
            description: "Configuration for 'create' and 'update' actions.",
        },
    },
});
export const gtmVersionHeaderSchema = createEntitySchema({
    name: "gtm_version_header",
    entityName: "container",
    description: `Performs all container version header operations: list, latest. The 'list' action returns up to ${PAGE_SIZES.DEFAULT} items per page.`,
    hierarchy: "container",
    actions: ["list", "latest"],
    pageSize: PAGE_SIZES.DEFAULT,
    includeCrudFields: false,
    extraFields: {
        includeDeleted: {
            type: "boolean",
            description: "Whether to also retrieve deleted (archived) versions. Required for 'list' action.",
        },
    },
});
export const gtmZoneSchema = createEntitySchema({
    name: "gtm_zone",
    entityName: "zone",
    description: `Performs various zone operations including create, get, list, update, remove, and revert actions. The 'list' action returns up to ${PAGE_SIZES.ZONE} items per page.`,
    hierarchy: "workspace",
    idField: "zoneId",
    idDescription: "The unique ID of the GTM Zone. Required for all actions except 'create' and 'list'.",
    actions: ["create", "get", "list", "update", "remove", "revert"],
    pageSize: PAGE_SIZES.ZONE,
});
// ==================== 특수 스키마 (빌더 패턴 미적용) ====================
export const gtmExportFullSchema = {
    name: "gtm_export_full",
    description: "Export COMPLETE GTM container data as JSON. Supports live version, specific version, or workspace (draft). When outputPath is provided, saves directly to file and returns only summary (recommended for large containers). Without outputPath, returns full data inline.",
    inputSchema: {
        type: "object",
        properties: {
            accountId: {
                type: "string",
                description: "The unique ID of the GTM Account.",
            },
            containerId: {
                type: "string",
                description: "The unique ID of the GTM Container.",
            },
            versionType: {
                type: "string",
                enum: ["live", "specific", "workspace"],
                description: "Export live version, a specific version, or workspace (draft without publishing).",
            },
            containerVersionId: {
                type: "string",
                description: "The version ID (required if versionType is 'specific').",
            },
            workspaceId: {
                type: "string",
                description: "The workspace ID (required if versionType is 'workspace').",
            },
            outputPath: {
                type: "string",
                description: "Absolute file path to save the JSON export. When provided, saves directly to file and returns only summary (avoids large response issues).",
            },
        },
        required: ["accountId", "containerId", "versionType"],
    },
};
export const gtmRemoveSessionSchema = {
    name: "gtm_remove_session",
    description: "Clear client data from MCP server and revoke google auth access",
    inputSchema: {
        type: "object",
        properties: {},
        required: [],
    },
};
export const gtmCacheSchema = {
    name: "gtm_cache",
    description: "Manage GTM MCP cache. Use 'clear' to force refresh data on next request. Use 'stats' to view cache status.",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["clear", "clearAll", "stats"],
                description: "'clear': Clear cache for specific workspace (requires accountId, containerId, workspaceId). 'clearAll': Clear all caches. 'stats': Show cache statistics.",
            },
            accountId: {
                type: "string",
                description: "Account ID (required for 'clear' action)",
            },
            containerId: {
                type: "string",
                description: "Container ID (required for 'clear' action)",
            },
            workspaceId: {
                type: "string",
                description: "Workspace ID (required for 'clear' action)",
            },
        },
        required: ["action"],
    },
};
