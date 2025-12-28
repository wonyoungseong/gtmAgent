import { z } from "zod";
import { getTagManagerClient, createErrorResponse, log } from "../utils/index.js";

// Tool definitions
const tools = [
  {
    name: "gtm_account",
    description: "List or get GTM accounts. Actions: 'list' to list all accounts, 'get' to get a specific account.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "get"],
          description: "The action to perform",
        },
        accountId: {
          type: "string",
          description: "The account ID (required for 'get' action)",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "gtm_container",
    description: "Manage GTM containers. Actions: 'list' to list containers in an account, 'get' to get a specific container.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "get"],
          description: "The action to perform",
        },
        accountId: {
          type: "string",
          description: "The account ID",
        },
        containerId: {
          type: "string",
          description: "The container ID (required for 'get' action)",
        },
      },
      required: ["action", "accountId"],
    },
  },
  {
    name: "gtm_workspace",
    description: "Manage GTM workspaces. Actions: 'list' to list workspaces, 'get' to get a specific workspace, 'getStatus' to get workspace status.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "get", "getStatus"],
          description: "The action to perform",
        },
        accountId: {
          type: "string",
          description: "The account ID",
        },
        containerId: {
          type: "string",
          description: "The container ID",
        },
        workspaceId: {
          type: "string",
          description: "The workspace ID (required for 'get' and 'getStatus' actions)",
        },
      },
      required: ["action", "accountId", "containerId"],
    },
  },
  {
    name: "gtm_version",
    description: "Get GTM container versions. Returns FULL data without pagination limits. Actions: 'live' to get live version, 'get' to get a specific version, 'list' to list version headers.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["live", "get", "list"],
          description: "The action to perform",
        },
        accountId: {
          type: "string",
          description: "The account ID",
        },
        containerId: {
          type: "string",
          description: "The container ID",
        },
        containerVersionId: {
          type: "string",
          description: "The version ID (required for 'get' action)",
        },
      },
      required: ["action", "accountId", "containerId"],
    },
  },
  {
    name: "gtm_tag",
    description: "Manage GTM tags in a workspace. Actions: 'list' to list all tags, 'get' to get a specific tag.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "get"],
          description: "The action to perform",
        },
        accountId: {
          type: "string",
          description: "The account ID",
        },
        containerId: {
          type: "string",
          description: "The container ID",
        },
        workspaceId: {
          type: "string",
          description: "The workspace ID",
        },
        tagId: {
          type: "string",
          description: "The tag ID (required for 'get' action)",
        },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  {
    name: "gtm_trigger",
    description: "Manage GTM triggers in a workspace. Actions: 'list' to list all triggers, 'get' to get a specific trigger.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "get"],
          description: "The action to perform",
        },
        accountId: {
          type: "string",
          description: "The account ID",
        },
        containerId: {
          type: "string",
          description: "The container ID",
        },
        workspaceId: {
          type: "string",
          description: "The workspace ID",
        },
        triggerId: {
          type: "string",
          description: "The trigger ID (required for 'get' action)",
        },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  {
    name: "gtm_variable",
    description: "Manage GTM variables in a workspace. Actions: 'list' to list all variables, 'get' to get a specific variable.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "get"],
          description: "The action to perform",
        },
        accountId: {
          type: "string",
          description: "The account ID",
        },
        containerId: {
          type: "string",
          description: "The container ID",
        },
        workspaceId: {
          type: "string",
          description: "The workspace ID",
        },
        variableId: {
          type: "string",
          description: "The variable ID (required for 'get' action)",
        },
      },
      required: ["action", "accountId", "containerId", "workspaceId"],
    },
  },
  {
    name: "gtm_export_full",
    description: "Export complete GTM container version data as JSON. Returns the full container version without any pagination or truncation.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "The account ID",
        },
        containerId: {
          type: "string",
          description: "The container ID",
        },
        versionType: {
          type: "string",
          enum: ["live", "specific"],
          description: "Export live version or a specific version",
        },
        containerVersionId: {
          type: "string",
          description: "The version ID (required if versionType is 'specific')",
        },
      },
      required: ["accountId", "containerId", "versionType"],
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
      case "gtm_account": {
        const action = args.action as string;
        if (action === "list") {
          const response = await tagmanager.accounts.list();
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        } else if (action === "get") {
          const response = await tagmanager.accounts.get({
            path: `accounts/${args.accountId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        }
        break;
      }

      case "gtm_container": {
        const action = args.action as string;
        const accountId = args.accountId as string;

        if (action === "list") {
          const response = await tagmanager.accounts.containers.list({
            parent: `accounts/${accountId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        } else if (action === "get") {
          const response = await tagmanager.accounts.containers.get({
            path: `accounts/${accountId}/containers/${args.containerId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        }
        break;
      }

      case "gtm_workspace": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;

        if (action === "list") {
          const response = await tagmanager.accounts.containers.workspaces.list({
            parent: `accounts/${accountId}/containers/${containerId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        } else if (action === "get") {
          const response = await tagmanager.accounts.containers.workspaces.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${args.workspaceId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        } else if (action === "getStatus") {
          const response = await tagmanager.accounts.containers.workspaces.getStatus({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${args.workspaceId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        }
        break;
      }

      case "gtm_version": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;

        if (action === "live") {
          // Return FULL live version data - no pagination!
          const response = await tagmanager.accounts.containers.versions.live({
            parent: `accounts/${accountId}/containers/${containerId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        } else if (action === "get") {
          // Return FULL version data - no pagination!
          const response = await tagmanager.accounts.containers.versions.get({
            path: `accounts/${accountId}/containers/${containerId}/versions/${args.containerVersionId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        } else if (action === "list") {
          const response = await tagmanager.accounts.containers.version_headers.list({
            parent: `accounts/${accountId}/containers/${containerId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        }
        break;
      }

      case "gtm_tag": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;

        if (action === "list") {
          const response = await tagmanager.accounts.containers.workspaces.tags.list({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        } else if (action === "get") {
          const response = await tagmanager.accounts.containers.workspaces.tags.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${args.tagId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        }
        break;
      }

      case "gtm_trigger": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;

        if (action === "list") {
          const response = await tagmanager.accounts.containers.workspaces.triggers.list({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        } else if (action === "get") {
          const response = await tagmanager.accounts.containers.workspaces.triggers.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${args.triggerId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        }
        break;
      }

      case "gtm_variable": {
        const action = args.action as string;
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const workspaceId = args.workspaceId as string;

        if (action === "list") {
          const response = await tagmanager.accounts.containers.workspaces.variables.list({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        } else if (action === "get") {
          const response = await tagmanager.accounts.containers.workspaces.variables.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${args.variableId}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
          };
        }
        break;
      }

      case "gtm_export_full": {
        const accountId = args.accountId as string;
        const containerId = args.containerId as string;
        const versionType = args.versionType as string;

        let versionData;
        if (versionType === "live") {
          const response = await tagmanager.accounts.containers.versions.live({
            parent: `accounts/${accountId}/containers/${containerId}`,
          });
          versionData = response.data;
        } else {
          const response = await tagmanager.accounts.containers.versions.get({
            path: `accounts/${accountId}/containers/${containerId}/versions/${args.containerVersionId}`,
          });
          versionData = response.data;
        }

        // Return complete export with summary
        const summary = {
          containerVersionId: versionData.containerVersionId,
          name: versionData.name,
          description: versionData.description,
          fingerprint: versionData.fingerprint,
          tagCount: versionData.tag?.length || 0,
          triggerCount: versionData.trigger?.length || 0,
          variableCount: versionData.variable?.length || 0,
          folderCount: versionData.folder?.length || 0,
          builtInVariableCount: versionData.builtInVariable?.length || 0,
          customTemplateCount: versionData.customTemplate?.length || 0,
          clientCount: versionData.client?.length || 0,
          zoneCount: versionData.zone?.length || 0,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary,
                  fullData: versionData,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    throw new Error(`Invalid action for tool ${name}`);
  } catch (error) {
    return createErrorResponse(`Error in ${name}`, error);
  }
}
