import { getTagManagerClient, createErrorResponse, log, clearCachedClient } from "../utils/index.js";
import {
  paginateArray,
  processVersionData
} from "../utils/pagination.js";
import {
  getFromFileCacheWithValidation,
  setToFileCache,
  invalidateFileCache,
  getCachedWorkspaceFingerprint,
  setCachedWorkspaceFingerprint,
  clearAllWorkspaceCache,
  clearAllCache
} from "../utils/file-cache.js";
import * as fs from "fs";
import * as path from "path";

// ==================== Session Context ====================
// 현재 선택된 Account/Container/Workspace를 저장하는 세션 컨텍스트
interface SessionContext {
  accountId: string | null;
  accountName: string | null;
  containerId: string | null;
  containerName: string | null;
  containerPublicId: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
}

let sessionContext: SessionContext = {
  accountId: null,
  accountName: null,
  containerId: null,
  containerName: null,
  containerPublicId: null,
  workspaceId: null,
  workspaceName: null,
};

// 컨텍스트에서 ID를 가져오거나, 파라미터가 없으면 에러 메시지 생성
function getAccountId(args: Record<string, unknown>): string {
  const id = (args.accountId as string) || sessionContext.accountId;
  if (!id) {
    throw new Error("accountId가 필요합니다. gtm_context로 먼저 환경을 설정하거나, accountId를 직접 전달하세요.");
  }
  return id;
}

function getContainerId(args: Record<string, unknown>): string {
  const id = (args.containerId as string) || sessionContext.containerId;
  if (!id) {
    throw new Error("containerId가 필요합니다. gtm_context로 먼저 환경을 설정하거나, containerId를 직접 전달하세요.");
  }
  return id;
}

function getWorkspaceId(args: Record<string, unknown>): string {
  const id = (args.workspaceId as string) || sessionContext.workspaceId;
  if (!id) {
    throw new Error("workspaceId가 필요합니다. gtm_context로 먼저 환경을 설정하거나, workspaceId를 직접 전달하세요.");
  }
  return id;
}

// 컨텍스트 상태를 포맷팅
function formatContextStatus(): string {
  if (!sessionContext.accountId) {
    return "컨텍스트가 설정되지 않았습니다. gtm_context action='set'으로 환경을 설정하세요.";
  }

  let status = `현재 컨텍스트:\n`;
  status += `- Account: ${sessionContext.accountName || sessionContext.accountId} (${sessionContext.accountId})\n`;

  if (sessionContext.containerId) {
    status += `- Container: ${sessionContext.containerName || sessionContext.containerId}`;
    if (sessionContext.containerPublicId) {
      status += ` [${sessionContext.containerPublicId}]`;
    }
    status += ` (${sessionContext.containerId})\n`;
  }

  if (sessionContext.workspaceId) {
    status += `- Workspace: ${sessionContext.workspaceName || sessionContext.workspaceId} (${sessionContext.workspaceId})\n`;
  }

  return status;
}

// Page sizes matching Stape MCP
const TAG_PAGE_SIZE = 20;
const TRIGGER_PAGE_SIZE = 20;
const VARIABLE_PAGE_SIZE = 20;
const TEMPLATE_PAGE_SIZE = 20;
const ZONE_PAGE_SIZE = 20;
const VERSION_PAGE_SIZE = 20;
const DEFAULT_PAGE_SIZE = 50;

// Tool definitions matching Stape MCP exactly
const tools = [
  // ==================== gtm_context ====================
  {
    name: "gtm_context",
    description: `GTM 작업 환경(컨텍스트)을 관리합니다. 한 번 설정하면 이후 모든 도구 호출에서 accountId/containerId/workspaceId를 자동으로 사용합니다.

**권장 워크플로우:**
1. gtm_context action='set' → Account/Container/Workspace 선택
2. 이후 gtm_tag, gtm_trigger 등 호출 시 ID 생략 가능

**액션:**
- 'get': 현재 설정된 컨텍스트 조회
- 'set': 컨텍스트 설정 (accountId 필수, containerId/workspaceId 선택)
- 'clear': 컨텍스트 초기화`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "set", "clear"],
          description: "get: 현재 컨텍스트 조회, set: 컨텍스트 설정, clear: 컨텍스트 초기화",
        },
        accountId: {
          type: "string",
          description: "설정할 Account ID (set 액션에서 필수)",
        },
        containerId: {
          type: "string",
          description: "설정할 Container ID (set 액션에서 선택)",
        },
        workspaceId: {
          type: "string",
          description: "설정할 Workspace ID (set 액션에서 선택)",
        },
      },
      required: ["action"],
    },
  },
  // ==================== gtm_account ====================
  {
    name: "gtm_account",
    description: "Performs all account-related operations: get, list, update. Use the 'action' parameter to select the operation. 'list' requires no additional params. 'get' and 'update' require accountId.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "list", "update"],
          description: "The account operation to perform. 'list': returns all accessible accounts (no accountId needed). 'get': returns specific account (requires accountId). 'update': updates account (requires accountId and config).",
        },
        accountId: {
          type: "string",
          description: "The unique ID of the GTM Account. Required for 'get' and 'update' actions. Not needed for 'list'.",
        },
        config: {
          type: "object",
          description: "Configuration for 'update' action. All fields correspond to the GTM Account resource.",
        },
      },
      required: ["action"],
    },
  },
  // ==================== gtm_container ====================
  {
    name: "gtm_container",
    description: `Performs container-related operations: get, list, combine, lookup, moveTagId, snippet. The 'list' action returns up to itemsPerPage items per page. NOTE: create/update/remove actions are disabled for safety. **컨텍스트 지원**: gtm_context로 설정한 accountId/containerId를 자동으로 사용합니다.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "list", "combine", "lookup", "moveTagId", "snippet"],
          description: "The container operation to perform. Must be one of: 'get', 'list', 'combine', 'lookup', 'moveTagId', 'snippet'. NOTE: create/update/remove are disabled for safety.",
        },
        accountId: {
          type: "string",
          description: "The unique ID of the GTM Account. 생략 시 gtm_context에서 자동 사용.",
        },
        containerId: {
          type: "string",
          description: "The unique ID of the GTM Container. 생략 시 gtm_context에서 자동 사용.",
        },
        destinationId: {
          type: "string",
          description: "The destination ID linked to a GTM Container (e.g., AW-123456789). Required for the 'lookup' action.",
        },
        createOrUpdateConfig: {
          type: "object",
          description: "Configuration for 'create' and 'update' actions. All fields correspond to the GTM Container resource.",
        },
        fingerprint: {
          type: "string",
          description: "The fingerprint for optimistic concurrency control. Required for 'update' action.",
        },
        combineConfig: {
          type: "object",
          description: "Configuration for 'combine' action. Specifies which containers to combine.",
        },
        moveTagIdConfig: {
          type: "object",
          description: "Configuration for 'moveTagId' action. Specifies tag ID mapping for moving tags between containers.",
        },
        page: {
          type: "number",
          description: `Page number for pagination (starts from 1). Each page contains up to itemsPerPage items.`,
          default: 1,
        },
        itemsPerPage: {
          type: "number",
          description: `Number of items to return per page (1-${DEFAULT_PAGE_SIZE}). Default: ${DEFAULT_PAGE_SIZE}. Use lower values if experiencing response issues.`,
          default: DEFAULT_PAGE_SIZE,
        },
      },
      required: ["action"],  // accountId는 gtm_context에서 자동 사용 가능
    },
  },
  // ==================== gtm_workspace ====================
  {
    name: "gtm_workspace",
    description: `Performs various workspace operations including create, get, list, update, remove, createVersion, getStatus, sync, quickPreview, and resolveConflict actions. The 'list' action returns up to ${DEFAULT_PAGE_SIZE} items per page. **컨텍스트 지원**: gtm_context로 설정한 ID들을 자동으로 사용합니다.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "createVersion", "getStatus", "sync", "quickPreview", "resolveConflict"],
          description: "The workspace operation to perform.",
        },
        accountId: {
          type: "string",
          description: "The unique ID of the GTM Account. 생략 시 gtm_context에서 자동 사용.",
        },
        containerId: {
          type: "string",
          description: "The unique ID of the GTM Container. 생략 시 gtm_context에서 자동 사용.",
        },
        workspaceId: {
          type: "string",
          description: "The unique ID of the GTM Workspace. 생략 시 gtm_context에서 자동 사용. 일부 액션에서 필수.",
        },
        createOrUpdateConfig: {
          type: "object",
          description: "Configuration for 'create' and 'update' actions.",
        },
        fingerprint: {
          type: "string",
          description: "Fingerprint for optimistic concurrency control. Required for 'update' and 'resolveConflict' actions.",
        },
        entity: {
          type: "object",
          description: "The resolved entity for 'resolveConflict' action.",
        },
        changeStatus: {
          type: "string",
          description: "The status of the change for 'resolveConflict' action. Possible values: 'added', 'modified', 'deleted', 'unmodified'.",
        },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE },
      },
      required: ["action"],  // ID들은 gtm_context에서 자동 사용 가능
    },
  },
  // ==================== gtm_tag ====================
  {
    name: "gtm_tag",
    description: `Performs all GTM tag operations: create, get, list, update, remove, revert. The 'list' action returns up to ${TAG_PAGE_SIZE} items per page. **컨텍스트 지원**: gtm_context로 설정한 ID들을 자동으로 사용합니다.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "revert"],
          description: "The GTM tag operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove', 'revert'.",
        },
        accountId: { type: "string", description: "GTM Account ID. 생략 시 gtm_context에서 자동 사용." },
        containerId: { type: "string", description: "GTM Container ID. 생략 시 gtm_context에서 자동 사용." },
        workspaceId: { type: "string", description: "GTM Workspace ID. 생략 시 gtm_context에서 자동 사용." },
        tagId: { type: "string", description: "The unique ID of the GTM tag. Required for 'get', 'update', 'remove', and 'revert' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control. Required for 'update' and 'revert' actions." },
        page: { type: "number", default: 1, description: `Page number for pagination (starts from 1). Each page contains up to itemsPerPage items.` },
        itemsPerPage: { type: "number", default: TAG_PAGE_SIZE, maximum: TAG_PAGE_SIZE, description: `Number of items to return per page (1-${TAG_PAGE_SIZE}). Default: ${TAG_PAGE_SIZE}.` },
        refresh: { type: "boolean", default: false, description: "Force refresh cache by fetching latest data from API, ignoring cached data." },
      },
      required: ["action"],  // ID들은 gtm_context에서 자동 사용 가능
    },
  },
  // ==================== gtm_trigger ====================
  {
    name: "gtm_trigger",
    description: `Performs all GTM trigger operations: create, get, list, update, remove, revert. The 'list' action returns up to ${TRIGGER_PAGE_SIZE} items per page. **컨텍스트 지원**: gtm_context로 설정한 ID들을 자동으로 사용합니다.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "revert"],
          description: "The GTM trigger operation to perform.",
        },
        accountId: { type: "string", description: "GTM Account ID. 생략 시 gtm_context에서 자동 사용." },
        containerId: { type: "string", description: "GTM Container ID. 생략 시 gtm_context에서 자동 사용." },
        workspaceId: { type: "string", description: "GTM Workspace ID. 생략 시 gtm_context에서 자동 사용." },
        triggerId: { type: "string", description: "The unique ID of the GTM trigger. Required for 'get', 'update', 'remove', and 'revert' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: TRIGGER_PAGE_SIZE, maximum: TRIGGER_PAGE_SIZE },
        refresh: { type: "boolean", default: false, description: "Force refresh cache by fetching latest data from API, ignoring cached data." },
      },
      required: ["action"],  // ID들은 gtm_context에서 자동 사용 가능
    },
  },
  // ==================== gtm_variable ====================
  {
    name: "gtm_variable",
    description: `Performs all GTM variable operations: create, get, list, update, remove, revert. The 'list' action returns up to ${VARIABLE_PAGE_SIZE} items per page. **컨텍스트 지원**: gtm_context로 설정한 ID들을 자동으로 사용합니다.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "revert"],
          description: "The GTM variable operation to perform.",
        },
        accountId: { type: "string", description: "GTM Account ID. 생략 시 gtm_context에서 자동 사용." },
        containerId: { type: "string", description: "GTM Container ID. 생략 시 gtm_context에서 자동 사용." },
        workspaceId: { type: "string", description: "GTM Workspace ID. 생략 시 gtm_context에서 자동 사용." },
        variableId: { type: "string", description: "The unique ID of the GTM variable. Required for 'get', 'update', 'remove', and 'revert' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: VARIABLE_PAGE_SIZE, maximum: VARIABLE_PAGE_SIZE },
        refresh: { type: "boolean", default: false, description: "Force refresh cache by fetching latest data from API, ignoring cached data." },
      },
      required: ["action"],  // ID들은 gtm_context에서 자동 사용 가능
    },
  },
  // ==================== gtm_version ====================
  {
    name: "gtm_version",
    description: `Performs container version operations: get, live, setLatest, undelete, update. For 'get' and 'live' actions, use 'resourceType' to paginate specific resource arrays (up to ${VERSION_PAGE_SIZE} items per page) to avoid response truncation. NOTE: publish/remove actions are disabled for safety.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "live", "setLatest", "undelete", "update"],
          description: "The container version operation to perform. NOTE: publish/remove are disabled for safety.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the container version." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the version." },
        containerVersionId: { type: "string", description: "The unique ID of the GTM container version. Required for 'get', 'setLatest', 'undelete', and 'update' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control. Required for 'update' actions." },
        resourceType: {
          type: "string",
          enum: ["tag", "trigger", "variable", "folder", "builtInVariable", "zone", "customTemplate", "client", "gtagConfig", "transformation"],
          description: "Specific resource type to retrieve with pagination (only for 'get' and 'live' actions).",
        },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: VERSION_PAGE_SIZE, maximum: VERSION_PAGE_SIZE },
        includeSummary: { type: "boolean", default: true, description: "Include counts and metadata for all resource types." },
      },
      required: ["action", "accountId", "containerId"],
    },
  },
  // ==================== gtm_built_in_variable ====================
  {
    name: "gtm_built_in_variable",
    description: `Performs all built-in variable operations: create, list, remove, revert. The 'list' action returns up to itemsPerPage items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "list", "remove", "revert"],
          description: "The built-in variable operation to perform. Must be one of: 'create', 'list', 'remove', 'revert'.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the built-in variable." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the built-in variable." },
        workspaceId: { type: "string", description: "The unique ID of the GTM Workspace containing the built-in variable." },
        type: { type: "string", description: "The built-in variable type. Required for 'revert' and 'remove' actions." },
        types: { type: "array", items: { type: "string" }, description: "Array of built-in variable types. Optional for 'list' action." },
        pageToken: { type: "string", description: "A token for pagination. Optional for 'list' action." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE, maximum: DEFAULT_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  // ==================== gtm_client ====================
  {
    name: "gtm_client",
    description: `Performs all client operations: create, get, list, update, remove, revert. The 'list' action returns up to itemsPerPage items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "revert"],
          description: "The client operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove', 'revert'.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the client." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the client." },
        workspaceId: { type: "string", description: "The unique ID of the GTM Workspace containing the client." },
        clientId: { type: "string", description: "The unique ID of the GTM Client. Required for 'get', 'update', 'remove', and 'revert' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE, maximum: DEFAULT_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  // ==================== gtm_destination ====================
  {
    name: "gtm_destination",
    description: `Performs all destination operations: get, list, link, unlink.  The 'list' action returns up to ${DEFAULT_PAGE_SIZE} items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "list", "link", "unlink"],
          description: "The destination operation to perform. Must be one of: 'get', 'list', 'link', 'unlink'.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the destination." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the destination." },
        destinationId: { type: "string", description: "The unique ID of the GTM Destination. Required for 'get', 'link', and 'unlink' actions." },
        allowUserPermissionFeatureUpdate: { type: "boolean", description: "If true, allows user permission feature update during linking." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE, maximum: DEFAULT_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId"],
    },
  },
  // ==================== gtm_environment ====================
  {
    name: "gtm_environment",
    description: `Performs all environment operations: create, get, list, update, remove, reauthorize.  The 'list' action returns up to ${DEFAULT_PAGE_SIZE} items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "reauthorize"],
          description: "The environment operation to perform.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the environment." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the environment." },
        environmentId: { type: "string", description: "The unique ID of the GTM Environment. Required for 'get', 'update', 'remove', and 'reauthorize' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE, maximum: DEFAULT_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId"],
    },
  },
  // ==================== gtm_folder ====================
  {
    name: "gtm_folder",
    description: `Performs all folder operations: create, get, list, update, remove, revert, entities, moveEntitiesToFolder. The 'list' action returns up to ${DEFAULT_PAGE_SIZE} items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "revert", "entities", "moveEntitiesToFolder"],
          description: "The folder operation to perform.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the folder." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the folder." },
        workspaceId: { type: "string", description: "The unique ID of the GTM Workspace containing the folder." },
        folderId: { type: "string", description: "The unique ID of the GTM Folder." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control." },
        tagId: { type: "array", items: { type: "string" }, description: "The tags to be moved to the folder." },
        triggerId: { type: "array", items: { type: "string" }, description: "The triggers to be moved to the folder." },
        variableId: { type: "array", items: { type: "string" }, description: "The variables to be moved to the folder." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE, maximum: DEFAULT_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  // ==================== gtm_gtag_config ====================
  {
    name: "gtm_gtag_config",
    description: `Performs all Google tag config operations: create, get, list, update, remove. The 'list' action returns up to itemsPerPage items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove"],
          description: "The Google tag config operation to perform.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the Google tag config." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the Google tag config." },
        workspaceId: { type: "string", description: "The unique ID of the GTM Workspace containing the Google tag config." },
        gtagConfigId: { type: "string", description: "The unique ID of the Google tag config. Required for 'get', 'update', and 'remove' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE, maximum: DEFAULT_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  // ==================== gtm_template ====================
  {
    name: "gtm_template",
    description: `Performs all GTM custom template operations: create, get, list, update, remove, revert. The 'list' action returns up to itemsPerPage items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "revert"],
          description: "The GTM custom template operation to perform.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the custom template." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the custom template." },
        workspaceId: { type: "string", description: "The unique ID of the GTM Workspace containing the custom template." },
        templateId: { type: "string", description: "The unique ID of the GTM custom template. Required for 'get', 'update', 'remove', and 'revert' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: TEMPLATE_PAGE_SIZE, maximum: TEMPLATE_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  // ==================== gtm_transformation ====================
  {
    name: "gtm_transformation",
    description: `Performs all GTM transformation operations: create, get, list, update, remove, revert. The 'list' action returns up to itemsPerPage items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "revert"],
          description: "The GTM transformation operation to perform.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the transformation." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the transformation." },
        workspaceId: { type: "string", description: "The unique ID of the GTM Workspace containing the transformation." },
        transformationId: { type: "string", description: "The unique ID of the GTM transformation. Required for 'get', 'update', 'remove', and 'revert' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "The fingerprint for optimistic concurrency control." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE, maximum: DEFAULT_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  // ==================== gtm_user_permission ====================
  {
    name: "gtm_user_permission",
    description: `Performs all user permission operations: create, get, list, update, remove. The 'list' action returns up to ${DEFAULT_PAGE_SIZE} items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove"],
          description: "The user permission operation to perform.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the user permission." },
        userPermissionId: { type: "string", description: "The unique ID of the user permission. Required for 'get', 'update', and 'remove' actions." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE, maximum: DEFAULT_PAGE_SIZE },
      },
      required: ["action", "accountId"],
    },
  },
  // ==================== gtm_version_header ====================
  {
    name: "gtm_version_header",
    description: `Performs all container version header operations: list, latest. The 'list' action returns up to ${DEFAULT_PAGE_SIZE} items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "latest"],
          description: "The container version header operation to perform. Must be one of: 'list', 'latest'.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the container." },
        containerId: { type: "string", description: "The unique ID of the GTM Container." },
        includeDeleted: { type: "boolean", description: "Whether to also retrieve deleted (archived) versions. Required for 'list' action." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: DEFAULT_PAGE_SIZE, maximum: DEFAULT_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId"],
    },
  },
  // ==================== gtm_zone ====================
  {
    name: "gtm_zone",
    description: `Performs various zone operations including create, get, list, update, remove, and revert actions. The 'list' action returns up to ${ZONE_PAGE_SIZE} items per page.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "get", "list", "update", "remove", "revert"],
          description: "The zone operation to perform.",
        },
        accountId: { type: "string", description: "The unique ID of the GTM Account containing the zone." },
        containerId: { type: "string", description: "The unique ID of the GTM Container containing the zone." },
        workspaceId: { type: "string", description: "The unique ID of the GTM Workspace containing the zone." },
        zoneId: { type: "string", description: "The unique ID of the GTM Zone. Required for all actions except 'create' and 'list'." },
        createOrUpdateConfig: { type: "object", description: "Configuration for 'create' and 'update' actions." },
        fingerprint: { type: "string", description: "Fingerprint for optimistic concurrency control." },
        page: { type: "number", default: 1 },
        itemsPerPage: { type: "number", default: ZONE_PAGE_SIZE, maximum: ZONE_PAGE_SIZE },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  // ==================== gtm_export_full ====================
  {
    name: "gtm_export_full",
    description: "Export COMPLETE GTM container data as JSON. Supports live version, specific version, or workspace (draft). When outputPath is provided, saves directly to file and returns only summary (recommended for large containers). Without outputPath, returns full data inline.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "The unique ID of the GTM Account." },
        containerId: { type: "string", description: "The unique ID of the GTM Container." },
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
  },
  // ==================== gtm_remove_session ====================
  {
    name: "gtm_remove_session",
    description: "Clear client data from MCP server and revoke google auth access",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  // ==================== gtm_cache ====================
  {
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
        accountId: { type: "string", description: "Account ID (required for 'clear' action)" },
        containerId: { type: "string", description: "Container ID (required for 'clear' action)" },
        workspaceId: { type: "string", description: "Workspace ID (required for 'clear' action)" },
      },
      required: ["action"],
    },
  },
];

export function registerAllTools() {
  return tools;
}

export async function handleToolCall(name: string, args: Record<string, unknown>) {
  log(`Tool call: ${name}`, JSON.stringify(args));

  try {
    const tagmanager = await getTagManagerClient();

    switch (name) {
      // ==================== gtm_context ====================
      case "gtm_context": {
        const action = args.action as string;

        switch (action) {
          case "get": {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  context: sessionContext,
                  status: formatContextStatus(),
                }, null, 2)
              }]
            };
          }
          case "set": {
            const accountId = args.accountId as string;
            const containerId = args.containerId as string | undefined;
            const workspaceId = args.workspaceId as string | undefined;

            if (!accountId) {
              throw new Error("accountId는 set 액션에서 필수입니다.");
            }

            // Account 정보 조회
            const accountRes = await tagmanager.accounts.get({ path: `accounts/${accountId}` });
            sessionContext.accountId = accountId;
            sessionContext.accountName = accountRes.data.name || null;

            // Container 정보 조회 (제공된 경우)
            if (containerId) {
              const containerRes = await tagmanager.accounts.containers.get({
                path: `accounts/${accountId}/containers/${containerId}`
              });
              sessionContext.containerId = containerId;
              sessionContext.containerName = containerRes.data.name || null;
              sessionContext.containerPublicId = containerRes.data.publicId || null;
            } else {
              sessionContext.containerId = null;
              sessionContext.containerName = null;
              sessionContext.containerPublicId = null;
            }

            // Workspace 정보 조회 (제공된 경우)
            if (workspaceId && containerId) {
              const workspaceRes = await tagmanager.accounts.containers.workspaces.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
              });
              sessionContext.workspaceId = workspaceId;
              sessionContext.workspaceName = workspaceRes.data.name || null;
            } else {
              sessionContext.workspaceId = null;
              sessionContext.workspaceName = null;
            }

            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "컨텍스트가 설정되었습니다.",
                  context: sessionContext,
                  status: formatContextStatus(),
                }, null, 2)
              }]
            };
          }
          case "clear": {
            sessionContext = {
              accountId: null,
              accountName: null,
              containerId: null,
              containerName: null,
              containerPublicId: null,
              workspaceId: null,
              workspaceName: null,
            };
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "컨텍스트가 초기화되었습니다.",
                }, null, 2)
              }]
            };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_account ====================
      case "gtm_account": {
        const action = args.action as string;
        const accountId = args.accountId as string;

        switch (action) {
          case "list": {
            // No accountId required - lists all accessible accounts
            const response = await tagmanager.accounts.list({});
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!accountId) throw new Error("accountId is required for get action");
            const response = await tagmanager.accounts.get({ path: `accounts/${accountId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "update": {
            if (!accountId) throw new Error("accountId is required for update action");
            const config = args.config as Record<string, unknown>;
            if (!config) throw new Error("config is required for update action");
            const response = await tagmanager.accounts.update({ path: `accounts/${accountId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_container ====================
      case "gtm_container": {
        const action = args.action as string;
        const accountId = getAccountId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const containerId = (args.containerId as string) || sessionContext.containerId || "";
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.create({ parent: `accounts/${accountId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!containerId) throw new Error("containerId is required for get action");
            const response = await tagmanager.accounts.containers.get({ path: `accounts/${accountId}/containers/${containerId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.list({ parent: `accounts/${accountId}`, pageToken: currentPageToken });
              if (response.data.container) all = all.concat(response.data.container);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!containerId) throw new Error("containerId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.update({ path: `accounts/${accountId}/containers/${containerId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "create":
          case "update":
          case "remove": {
            throw new Error(`SAFETY: Container ${action} action is disabled. Container create/update/remove operations are not allowed via API for safety reasons.`);
          }
          case "combine": {
            const combineConfig = args.combineConfig as Record<string, unknown>;
            if (!combineConfig) throw new Error("combineConfig is required for combine action");
            const { fromContainerId, toContainerId, allowUserPermissionFeatureUpdate, settingSource } = combineConfig;
            const response = await tagmanager.accounts.containers.combine({
              path: `accounts/${accountId}/containers/${fromContainerId}`,
              containerId: toContainerId as string,
              allowUserPermissionFeatureUpdate: allowUserPermissionFeatureUpdate as boolean,
              settingSource: settingSource as string,
            });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "lookup": {
            const destinationId = args.destinationId as string;
            if (!destinationId) throw new Error("destinationId is required for lookup action");
            const response = await tagmanager.accounts.containers.lookup({ destinationId });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "moveTagId": {
            if (!containerId) throw new Error("containerId is required for moveTagId action");
            const moveTagIdConfig = args.moveTagIdConfig as Record<string, unknown>;
            if (!moveTagIdConfig) throw new Error("moveTagIdConfig is required for moveTagId action");
            const { tagId, tagName, allowUserPermissionFeatureUpdate, copySettings, copyTermsOfService, copyUsers } = moveTagIdConfig;
            const response = await tagmanager.accounts.containers.move_tag_id({
              path: `accounts/${accountId}/containers/${containerId}`,
              tagId: tagId as string,
              tagName: tagName as string,
              allowUserPermissionFeatureUpdate: allowUserPermissionFeatureUpdate as boolean,
              copySettings: copySettings as boolean,
              copyTermsOfService: copyTermsOfService as boolean,
              copyUsers: copyUsers as boolean,
            });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "snippet": {
            if (!containerId) throw new Error("containerId is required for snippet action");
            const response = await tagmanager.accounts.containers.snippet({ path: `accounts/${accountId}/containers/${containerId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_workspace ====================
      case "gtm_workspace": {
        const action = args.action as string;
        const accountId = getAccountId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const containerId = getContainerId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const workspaceId = (args.workspaceId as string) || sessionContext.workspaceId || "";
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.create({ parent: `accounts/${accountId}/containers/${containerId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            const wsId = workspaceId || getWorkspaceId(args);
            const response = await tagmanager.accounts.containers.workspaces.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${wsId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.workspaces.list({ parent: `accounts/${accountId}/containers/${containerId}`, pageToken: currentPageToken });
              if (response.data.workspace) all = all.concat(response.data.workspace);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!workspaceId) throw new Error("workspaceId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!workspaceId) throw new Error("workspaceId is required for remove action");
            await tagmanager.accounts.containers.workspaces.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}` });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Workspace ${workspaceId} removed successfully` }, null, 2) }] };
          }
          case "createVersion": {
            if (!workspaceId) throw new Error("workspaceId is required for createVersion action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const response = await tagmanager.accounts.containers.workspaces.create_version({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config || {} });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "getStatus": {
            if (!workspaceId) throw new Error("workspaceId is required for getStatus action");
            const response = await tagmanager.accounts.containers.workspaces.getStatus({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "sync": {
            if (!workspaceId) throw new Error("workspaceId is required for sync action");
            const response = await tagmanager.accounts.containers.workspaces.sync({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "quickPreview": {
            if (!workspaceId) throw new Error("workspaceId is required for quickPreview action");
            const response = await tagmanager.accounts.containers.workspaces.quick_preview({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "resolveConflict": {
            if (!workspaceId) throw new Error("workspaceId is required for resolveConflict action");
            const fingerprint = args.fingerprint as string;
            const entity = args.entity as Record<string, unknown>;
            const changeStatus = args.changeStatus as string;
            if (!fingerprint) throw new Error("fingerprint is required for resolveConflict action");
            if (!entity) throw new Error("entity is required for resolveConflict action");
            if (!changeStatus) throw new Error("changeStatus is required for resolveConflict action");
            const entityName = Object.keys(entity);
            await tagmanager.accounts.containers.workspaces.resolve_conflict({
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
              fingerprint,
              requestBody: { changeStatus, [entityName[0]]: entity[entityName[0]] } as unknown as Record<string, unknown>,
            });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Conflict resolved in workspace ${workspaceId}` }, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_tag ====================
      case "gtm_tag": {
        const action = args.action as string;
        const accountId = getAccountId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const containerId = getContainerId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const workspaceId = getWorkspaceId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const tagId = args.tagId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || TAG_PAGE_SIZE, TAG_PAGE_SIZE);
        const refresh = args.refresh as boolean || false;

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.tags.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config });
            invalidateFileCache(accountId, containerId, workspaceId, "tag");
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!tagId) throw new Error("tagId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.tags.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] | null = null;
            let currentFingerprint: string | null = null;

            // Skip all cache if refresh=true
            if (refresh) {
              log(`[Cache] Tag cache refresh requested`);
              invalidateFileCache(accountId, containerId, workspaceId, "tag");
            } else {
              // Try fingerprint cache first (fast, in-memory)
              currentFingerprint = getCachedWorkspaceFingerprint(accountId, containerId, workspaceId);

              if (currentFingerprint) {
                // Fingerprint cache hit - validate file cache
                const cacheResult = getFromFileCacheWithValidation<unknown>(
                  accountId, containerId, workspaceId, "tag", currentFingerprint
                );
                if (cacheResult.valid) {
                  all = cacheResult.data;
                }
              }
            }

            // Cache miss or refresh: fetch from API
            if (!all) {
              // Get current fingerprint from API (if not already fetched)
              if (!currentFingerprint || refresh) {
                const wsResponse = await tagmanager.accounts.containers.workspaces.get({
                  path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
                });
                currentFingerprint = wsResponse.data.fingerprint as string;
                // Cache the fingerprint for 1 minute
                setCachedWorkspaceFingerprint(accountId, containerId, workspaceId, currentFingerprint);
              }

              // Fetch all tags from API
              all = [];
              let currentPageToken = "";
              do {
                const response = await tagmanager.accounts.containers.workspaces.tags.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
                if (response.data.tag) all = all.concat(response.data.tag);
                currentPageToken = response.data.nextPageToken || "";
              } while (currentPageToken);
              // Save to file cache with fingerprint
              setToFileCache(accountId, containerId, workspaceId, "tag", all, currentFingerprint);
            }
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!tagId) throw new Error("tagId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.tags.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`, fingerprint, requestBody: config });
            invalidateFileCache(accountId, containerId, workspaceId, "tag");
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!tagId) throw new Error("tagId is required for remove action");
            await tagmanager.accounts.containers.workspaces.tags.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}` });
            invalidateFileCache(accountId, containerId, workspaceId, "tag");
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Tag ${tagId} was successfully deleted` }, null, 2) }] };
          }
          case "revert": {
            if (!tagId) throw new Error("tagId is required for revert action");
            const fingerprint = args.fingerprint as string;
            const response = await tagmanager.accounts.containers.workspaces.tags.revert({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`, fingerprint });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_trigger ====================
      case "gtm_trigger": {
        const action = args.action as string;
        const accountId = getAccountId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const containerId = getContainerId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const workspaceId = getWorkspaceId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const triggerId = args.triggerId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || TRIGGER_PAGE_SIZE, TRIGGER_PAGE_SIZE);
        const refresh = args.refresh as boolean || false;

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.triggers.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config });
            invalidateFileCache(accountId, containerId, workspaceId, "trigger");
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!triggerId) throw new Error("triggerId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.triggers.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] | null = null;
            let currentFingerprint: string | null = null;

            // Skip all cache if refresh=true
            if (refresh) {
              log(`[Cache] Trigger cache refresh requested`);
              invalidateFileCache(accountId, containerId, workspaceId, "trigger");
            } else {
              // Try fingerprint cache first (fast, in-memory)
              currentFingerprint = getCachedWorkspaceFingerprint(accountId, containerId, workspaceId);

              if (currentFingerprint) {
                // Fingerprint cache hit - validate file cache
                const cacheResult = getFromFileCacheWithValidation<unknown>(
                  accountId, containerId, workspaceId, "trigger", currentFingerprint
                );
                if (cacheResult.valid) {
                  all = cacheResult.data;
                }
              }
            }

            // Cache miss or refresh: fetch from API
            if (!all) {
              // Get current fingerprint from API (if not already fetched)
              if (!currentFingerprint || refresh) {
                const wsResponse = await tagmanager.accounts.containers.workspaces.get({
                  path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
                });
                currentFingerprint = wsResponse.data.fingerprint as string;
                // Cache the fingerprint for 1 minute
                setCachedWorkspaceFingerprint(accountId, containerId, workspaceId, currentFingerprint);
              }

              // Fetch all triggers from API
              all = [];
              let currentPageToken = "";
              do {
                const response = await tagmanager.accounts.containers.workspaces.triggers.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
                if (response.data.trigger) all = all.concat(response.data.trigger);
                currentPageToken = response.data.nextPageToken || "";
              } while (currentPageToken);
              // Save to file cache with fingerprint
              setToFileCache(accountId, containerId, workspaceId, "trigger", all, currentFingerprint);
            }
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!triggerId) throw new Error("triggerId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.triggers.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`, fingerprint, requestBody: config });
            invalidateFileCache(accountId, containerId, workspaceId, "trigger");
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!triggerId) throw new Error("triggerId is required for remove action");
            await tagmanager.accounts.containers.workspaces.triggers.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}` });
            invalidateFileCache(accountId, containerId, workspaceId, "trigger");
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Trigger ${triggerId} was successfully deleted` }, null, 2) }] };
          }
          case "revert": {
            if (!triggerId) throw new Error("triggerId is required for revert action");
            const fingerprint = args.fingerprint as string;
            const response = await tagmanager.accounts.containers.workspaces.triggers.revert({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`, fingerprint });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_variable ====================
      case "gtm_variable": {
        const action = args.action as string;
        const accountId = getAccountId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const containerId = getContainerId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const workspaceId = getWorkspaceId(args);  // 컨텍스트 또는 파라미터에서 가져옴
        const variableId = args.variableId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || VARIABLE_PAGE_SIZE, VARIABLE_PAGE_SIZE);
        const refresh = args.refresh as boolean || false;

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.variables.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config });
            invalidateFileCache(accountId, containerId, workspaceId, "variable");
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!variableId) throw new Error("variableId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.variables.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] | null = null;
            let currentFingerprint: string | null = null;

            // Skip all cache if refresh=true
            if (refresh) {
              log(`[Cache] Variable cache refresh requested`);
              invalidateFileCache(accountId, containerId, workspaceId, "variable");
            } else {
              // Try fingerprint cache first (fast, in-memory)
              currentFingerprint = getCachedWorkspaceFingerprint(accountId, containerId, workspaceId);

              if (currentFingerprint) {
                // Fingerprint cache hit - validate file cache
                const cacheResult = getFromFileCacheWithValidation<unknown>(
                  accountId, containerId, workspaceId, "variable", currentFingerprint
                );
                if (cacheResult.valid) {
                  all = cacheResult.data;
                }
              }
            }

            // Cache miss or refresh: fetch from API
            if (!all) {
              // Get current fingerprint from API (if not already fetched)
              if (!currentFingerprint || refresh) {
                const wsResponse = await tagmanager.accounts.containers.workspaces.get({
                  path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
                });
                currentFingerprint = wsResponse.data.fingerprint as string;
                // Cache the fingerprint for 1 minute
                setCachedWorkspaceFingerprint(accountId, containerId, workspaceId, currentFingerprint);
              }

              // Fetch all variables from API
              all = [];
              let currentPageToken = "";
              do {
                const response = await tagmanager.accounts.containers.workspaces.variables.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
                if (response.data.variable) all = all.concat(response.data.variable);
                currentPageToken = response.data.nextPageToken || "";
              } while (currentPageToken);
              // Save to file cache with fingerprint
              setToFileCache(accountId, containerId, workspaceId, "variable", all, currentFingerprint);
            }
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!variableId) throw new Error("variableId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.variables.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`, fingerprint, requestBody: config });
            invalidateFileCache(accountId, containerId, workspaceId, "variable");
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!variableId) throw new Error("variableId is required for remove action");
            await tagmanager.accounts.containers.workspaces.variables.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}` });
            invalidateFileCache(accountId, containerId, workspaceId, "variable");
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Variable ${variableId} was successfully deleted` }, null, 2) }] };
          }
          case "revert": {
            if (!variableId) throw new Error("variableId is required for revert action");
            const fingerprint = args.fingerprint as string;
            const response = await tagmanager.accounts.containers.workspaces.variables.revert({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`, fingerprint });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_version ====================
      case "gtm_version": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const containerVersionId = args.containerVersionId as string;
        const resourceType = args.resourceType as string | undefined;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || VERSION_PAGE_SIZE, VERSION_PAGE_SIZE);
        const includeSummary = args.includeSummary !== false;

        switch (action) {
          case "get": {
            if (!containerVersionId) throw new Error("containerVersionId is required for get action");
            const response = await tagmanager.accounts.containers.versions.get({ path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}` });
            const processedData = processVersionData(response.data as Record<string, unknown>, resourceType, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(processedData, null, 2) }] };
          }
          case "live": {
            const response = await tagmanager.accounts.containers.versions.live({ parent: `accounts/${accountId}/containers/${containerId}` });
            const processedData = processVersionData(response.data as Record<string, unknown>, resourceType, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(processedData, null, 2) }] };
          }
          case "publish":
          case "remove": {
            throw new Error(`SAFETY: Version ${action} action is disabled. Publishing and removing versions are not allowed via API for safety reasons. Please use GTM UI for these operations.`);
          }
          case "setLatest": {
            if (!containerVersionId) throw new Error("containerVersionId is required for setLatest action");
            const response = await tagmanager.accounts.containers.versions.set_latest({ path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "undelete": {
            if (!containerVersionId) throw new Error("containerVersionId is required for undelete action");
            const response = await tagmanager.accounts.containers.versions.undelete({ path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "update": {
            if (!containerVersionId) throw new Error("containerVersionId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.versions.update({ path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_built_in_variable ====================
      case "gtm_built_in_variable": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;
        const types = args.types as string[];
        const type = args.type as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "create": {
            if (!types) throw new Error("types is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.built_in_variables.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, type: types });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.workspaces.built_in_variables.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
              if (response.data.builtInVariable) all = all.concat(response.data.builtInVariable);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "remove": {
            if (!types) throw new Error("types is required for remove action");
            await tagmanager.accounts.containers.workspaces.built_in_variables.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/built_in_variables`, type: types });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Built-in variables deleted` }, null, 2) }] };
          }
          case "revert": {
            if (!type) throw new Error("type is required for revert action");
            const response = await tagmanager.accounts.containers.workspaces.built_in_variables.revert({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/built_in_variables`, type });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_client ====================
      case "gtm_client": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;
        const clientId = args.clientId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.clients.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!clientId) throw new Error("clientId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.clients.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.workspaces.clients.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
              if (response.data.client) all = all.concat(response.data.client);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!clientId) throw new Error("clientId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.clients.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!clientId) throw new Error("clientId is required for remove action");
            await tagmanager.accounts.containers.workspaces.clients.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}` });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Client ${clientId} was successfully deleted` }, null, 2) }] };
          }
          case "revert": {
            if (!clientId) throw new Error("clientId is required for revert action");
            const fingerprint = args.fingerprint as string;
            const response = await tagmanager.accounts.containers.workspaces.clients.revert({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`, fingerprint });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_destination ====================
      case "gtm_destination": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const destinationId = args.destinationId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "get": {
            if (!destinationId) throw new Error("destinationId is required for get action");
            const response = await tagmanager.accounts.containers.destinations.get({ path: `accounts/${accountId}/containers/${containerId}/destinations/${destinationId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            const response = await tagmanager.accounts.containers.destinations.list({ parent: `accounts/${accountId}/containers/${containerId}` });
            const all = response.data as unknown[];
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "link": {
            if (!destinationId) throw new Error("destinationId is required for link action");
            const allowUserPermissionFeatureUpdate = args.allowUserPermissionFeatureUpdate as boolean;
            const response = await tagmanager.accounts.containers.destinations.link({ parent: `accounts/${accountId}/containers/${containerId}`, destinationId, allowUserPermissionFeatureUpdate });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "unlink": {
            if (!destinationId) throw new Error("destinationId is required for unlink action");
            await tagmanager.accounts.containers.destinations.link({ parent: `accounts/${accountId}/containers/${containerId}`, destinationId });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Destination ${destinationId} was successfully unlinked` }, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_environment ====================
      case "gtm_environment": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const environmentId = args.environmentId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.environments.create({ parent: `accounts/${accountId}/containers/${containerId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!environmentId) throw new Error("environmentId is required for get action");
            const response = await tagmanager.accounts.containers.environments.get({ path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.environments.list({ parent: `accounts/${accountId}/containers/${containerId}`, pageToken: currentPageToken });
              if (response.data.environment) all = all.concat(response.data.environment);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!environmentId) throw new Error("environmentId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.environments.update({ path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!environmentId) throw new Error("environmentId is required for remove action");
            await tagmanager.accounts.containers.environments.delete({ path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}` });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Environment ${environmentId} was successfully deleted` }, null, 2) }] };
          }
          case "reauthorize": {
            if (!environmentId) throw new Error("environmentId is required for reauthorize action");
            const response = await tagmanager.accounts.containers.environments.reauthorize({ path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_folder ====================
      case "gtm_folder": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;
        const folderId = args.folderId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.folders.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!folderId) throw new Error("folderId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.folders.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.workspaces.folders.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
              if (response.data.folder) all = all.concat(response.data.folder);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!folderId) throw new Error("folderId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.folders.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!folderId) throw new Error("folderId is required for remove action");
            await tagmanager.accounts.containers.workspaces.folders.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}` });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Folder ${folderId} was successfully deleted` }, null, 2) }] };
          }
          case "revert": {
            if (!folderId) throw new Error("folderId is required for revert action");
            const fingerprint = args.fingerprint as string;
            const response = await tagmanager.accounts.containers.workspaces.folders.revert({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`, fingerprint });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "entities": {
            if (!folderId) throw new Error("folderId is required for entities action");
            const response = await tagmanager.accounts.containers.workspaces.folders.entities({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "moveEntitiesToFolder": {
            if (!folderId) throw new Error("folderId is required for moveEntitiesToFolder action");
            const tagId = args.tagId as string[];
            const triggerId = args.triggerId as string[];
            const variableId = args.variableId as string[];
            if (!tagId && !triggerId && !variableId) throw new Error("At least one of tagId, triggerId, or variableId is required");
            await tagmanager.accounts.containers.workspaces.folders.move_entities_to_folder({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`, tagId, triggerId, variableId });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Entities moved to folder ${folderId}` }, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_gtag_config ====================
      case "gtm_gtag_config": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;
        const gtagConfigId = args.gtagConfigId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.gtag_config.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!gtagConfigId) throw new Error("gtagConfigId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.gtag_config.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.workspaces.gtag_config.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
              if (response.data.gtagConfig) all = all.concat(response.data.gtagConfig);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!gtagConfigId) throw new Error("gtagConfigId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.gtag_config.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!gtagConfigId) throw new Error("gtagConfigId is required for remove action");
            await tagmanager.accounts.containers.workspaces.gtag_config.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}` });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Google tag config ${gtagConfigId} was successfully deleted` }, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_template ====================
      case "gtm_template": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;
        const templateId = args.templateId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || TEMPLATE_PAGE_SIZE, TEMPLATE_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.templates.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!templateId) throw new Error("templateId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.templates.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.workspaces.templates.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
              if (response.data.template) all = all.concat(response.data.template);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!templateId) throw new Error("templateId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.templates.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!templateId) throw new Error("templateId is required for remove action");
            await tagmanager.accounts.containers.workspaces.templates.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}` });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Template ${templateId} was successfully deleted` }, null, 2) }] };
          }
          case "revert": {
            if (!templateId) throw new Error("templateId is required for revert action");
            const fingerprint = args.fingerprint as string;
            const response = await tagmanager.accounts.containers.workspaces.templates.revert({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`, fingerprint });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_transformation ====================
      case "gtm_transformation": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;
        const transformationId = args.transformationId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.transformations.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!transformationId) throw new Error("transformationId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.transformations.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.workspaces.transformations.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
              if (response.data.transformation) all = all.concat(response.data.transformation);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!transformationId) throw new Error("transformationId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            if (!fingerprint) throw new Error("fingerprint is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.transformations.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!transformationId) throw new Error("transformationId is required for remove action");
            await tagmanager.accounts.containers.workspaces.transformations.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}` });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Transformation ${transformationId} was successfully deleted` }, null, 2) }] };
          }
          case "revert": {
            if (!transformationId) throw new Error("transformationId is required for revert action");
            const fingerprint = args.fingerprint as string;
            const response = await tagmanager.accounts.containers.workspaces.transformations.revert({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}`, fingerprint });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_user_permission ====================
      case "gtm_user_permission": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const userPermissionId = args.userPermissionId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.user_permissions.create({ parent: `accounts/${accountId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!userPermissionId) throw new Error("userPermissionId is required for get action");
            const response = await tagmanager.accounts.user_permissions.get({ path: `accounts/${accountId}/user_permissions/${userPermissionId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.user_permissions.list({ parent: `accounts/${accountId}`, pageToken: currentPageToken });
              if (response.data.userPermission) all = all.concat(response.data.userPermission);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!userPermissionId) throw new Error("userPermissionId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            const response = await tagmanager.accounts.user_permissions.update({ path: `accounts/${accountId}/user_permissions/${userPermissionId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!userPermissionId) throw new Error("userPermissionId is required for remove action");
            await tagmanager.accounts.user_permissions.delete({ path: `accounts/${accountId}/user_permissions/${userPermissionId}` });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `User permission ${userPermissionId} was successfully deleted` }, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_version_header ====================
      case "gtm_version_header": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const includeDeleted = args.includeDeleted as boolean;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);

        switch (action) {
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.version_headers.list({ parent: `accounts/${accountId}/containers/${containerId}`, includeDeleted, pageToken: currentPageToken });
              if (response.data.containerVersionHeader) all = all.concat(response.data.containerVersionHeader);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "latest": {
            const response = await tagmanager.accounts.containers.version_headers.latest({ parent: `accounts/${accountId}/containers/${containerId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_zone ====================
      case "gtm_zone": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;
        const zoneId = args.zoneId as string;
        const page = (args.page as number) || 1;
        const itemsPerPage = Math.min((args.itemsPerPage as number) || ZONE_PAGE_SIZE, ZONE_PAGE_SIZE);

        switch (action) {
          case "create": {
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            if (!config) throw new Error("createOrUpdateConfig is required for create action");
            const response = await tagmanager.accounts.containers.workspaces.zones.create({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "get": {
            if (!zoneId) throw new Error("zoneId is required for get action");
            const response = await tagmanager.accounts.containers.workspaces.zones.get({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}` });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "list": {
            let all: unknown[] = [];
            let currentPageToken = "";
            do {
              const response = await tagmanager.accounts.containers.workspaces.zones.list({ parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`, pageToken: currentPageToken });
              if (response.data.zone) all = all.concat(response.data.zone);
              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);
            const paginatedResult = paginateArray(all, page, itemsPerPage);
            return { content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }] };
          }
          case "update": {
            if (!zoneId) throw new Error("zoneId is required for update action");
            const config = args.createOrUpdateConfig as Record<string, unknown>;
            const fingerprint = args.fingerprint as string;
            if (!config) throw new Error("createOrUpdateConfig is required for update action");
            const response = await tagmanager.accounts.containers.workspaces.zones.update({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`, fingerprint, requestBody: config });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          case "remove": {
            if (!zoneId) throw new Error("zoneId is required for remove action");
            await tagmanager.accounts.containers.workspaces.zones.delete({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}` });
            return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Zone ${zoneId} removed successfully` }, null, 2) }] };
          }
          case "revert": {
            if (!zoneId) throw new Error("zoneId is required for revert action");
            const fingerprint = args.fingerprint as string;
            const response = await tagmanager.accounts.containers.workspaces.zones.revert({ path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`, fingerprint });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      // ==================== gtm_export_full ====================
      case "gtm_export_full": {
        // NO PAGINATION - Returns complete data for export
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const versionType = args.versionType as string;
        const outputPath = args.outputPath as string | undefined;

        let versionData: Record<string, unknown>;
        if (versionType === "live") {
          const response = await tagmanager.accounts.containers.versions.live({
            parent: `accounts/${accountId}/containers/${containerId}`,
          });
          versionData = response.data as Record<string, unknown>;
        } else if (versionType === "workspace") {
          // Export workspace (draft) without creating a version
          const workspaceId = args.workspaceId as string;
          if (!workspaceId) throw new Error("workspaceId is required for workspace export");

          const workspacePath = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;

          // Fetch all resources from workspace in parallel
          const [
            workspaceRes,
            containerRes,
            tagsRes,
            triggersRes,
            variablesRes,
            foldersRes,
            builtInVariablesRes,
            customTemplatesRes,
            clientsRes,
            zonesRes,
            transformationsRes,
          ] = await Promise.all([
            tagmanager.accounts.containers.workspaces.get({ path: workspacePath }),
            tagmanager.accounts.containers.get({ path: `accounts/${accountId}/containers/${containerId}` }),
            tagmanager.accounts.containers.workspaces.tags.list({ parent: workspacePath }),
            tagmanager.accounts.containers.workspaces.triggers.list({ parent: workspacePath }),
            tagmanager.accounts.containers.workspaces.variables.list({ parent: workspacePath }),
            tagmanager.accounts.containers.workspaces.folders.list({ parent: workspacePath }),
            tagmanager.accounts.containers.workspaces.built_in_variables.list({ parent: workspacePath }),
            tagmanager.accounts.containers.workspaces.templates.list({ parent: workspacePath }),
            tagmanager.accounts.containers.workspaces.clients.list({ parent: workspacePath }).catch(() => ({ data: { client: [] } })),
            tagmanager.accounts.containers.workspaces.zones.list({ parent: workspacePath }).catch(() => ({ data: { zone: [] } })),
            tagmanager.accounts.containers.workspaces.transformations.list({ parent: workspacePath }).catch(() => ({ data: { transformation: [] } })),
          ]);

          // Build workspace data structure similar to version export
          versionData = {
            path: workspacePath,
            accountId,
            containerId,
            workspaceId,
            name: workspaceRes.data.name,
            description: workspaceRes.data.description,
            fingerprint: workspaceRes.data.fingerprint,
            exportType: "workspace",
            exportedAt: new Date().toISOString(),
            container: containerRes.data,
            tag: tagsRes.data.tag || [],
            trigger: triggersRes.data.trigger || [],
            variable: variablesRes.data.variable || [],
            folder: foldersRes.data.folder || [],
            builtInVariable: builtInVariablesRes.data.builtInVariable || [],
            customTemplate: customTemplatesRes.data.template || [],
            client: clientsRes.data.client || [],
            zone: zonesRes.data.zone || [],
            transformation: transformationsRes.data.transformation || [],
          };
        } else {
          const containerVersionId = args.containerVersionId as string;
          if (!containerVersionId) throw new Error("containerVersionId is required for specific version export");
          const response = await tagmanager.accounts.containers.versions.get({
            path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
          });
          versionData = response.data as Record<string, unknown>;
        }

        // Build summary
        const container = versionData.container as Record<string, unknown> | undefined;
        const summary = {
          exportType: versionData.exportType || "version",
          containerVersionId: versionData.containerVersionId || null,
          workspaceId: versionData.workspaceId || null,
          name: versionData.name,
          description: versionData.description,
          fingerprint: versionData.fingerprint,
          exportedAt: versionData.exportedAt || null,
          containerName: container?.name || null,
          publicId: container?.publicId || null,
          tagCount: (versionData.tag as unknown[])?.length || 0,
          triggerCount: (versionData.trigger as unknown[])?.length || 0,
          variableCount: (versionData.variable as unknown[])?.length || 0,
          folderCount: (versionData.folder as unknown[])?.length || 0,
          builtInVariableCount: (versionData.builtInVariable as unknown[])?.length || 0,
          customTemplateCount: (versionData.customTemplate as unknown[])?.length || 0,
          clientCount: (versionData.client as unknown[])?.length || 0,
          zoneCount: (versionData.zone as unknown[])?.length || 0,
          transformationCount: (versionData.transformation as unknown[])?.length || 0,
        };

        // If outputPath provided, save to file and return only summary
        if (outputPath) {
          const fullData = { summary, fullData: versionData };
          const jsonContent = JSON.stringify(fullData, null, 2);

          // Ensure directory exists
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Write file
          fs.writeFileSync(outputPath, jsonContent, "utf-8");

          const fileSizeKB = Math.round(Buffer.byteLength(jsonContent, "utf-8") / 1024);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "GTM container exported successfully",
                  outputPath,
                  fileSizeKB,
                  summary,
                }, null, 2),
              },
            ],
          };
        }

        // Without outputPath, return full data inline (may cause size issues for large containers)
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ summary, fullData: versionData }, null, 2),
            },
          ],
        };
      }

      // ==================== gtm_remove_session ====================
      case "gtm_remove_session": {
        // 캐시된 인증 클라이언트 초기화 (새 토큰 적용을 위해 필수)
        clearCachedClient();
        // 파일 캐시도 초기화
        clearAllCache();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, message: "Cached auth client and all caches cleared. New token will be loaded on next API call." }, null, 2) }] };
      }

      // ==================== gtm_cache ====================
      case "gtm_cache": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;

        switch (action) {
          case "clear": {
            if (!accountId || !containerId || !workspaceId) {
              throw new Error("accountId, containerId, and workspaceId are required for 'clear' action");
            }
            const result = clearAllWorkspaceCache(accountId, containerId, workspaceId);
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: `Cache cleared for workspace ${workspaceId}`,
                  filesDeleted: result.filesDeleted,
                  fingerprintCleared: result.fingerprintCleared,
                }, null, 2)
              }]
            };
          }
          case "clearAll": {
            const result = clearAllCache();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "All caches cleared",
                  filesDeleted: result.filesDeleted,
                  fingerprintsCleared: result.fingerprintsCleared,
                }, null, 2)
              }]
            };
          }
          case "stats": {
            const { getFileCacheStats } = await import("../utils/file-cache.js");
            const stats = getFileCacheStats();
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  totalCacheFiles: stats.totalFiles,
                  files: stats.files,
                  fingerprintCacheEntries: stats.fingerprintCacheSize,
                }, null, 2)
              }]
            };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return createErrorResponse(`Error in ${name}`, error);
  }
}
