/**
 * GTM Workflow Tool Schema
 * Agent System을 MCP 도구로 노출
 */
export const gtmWorkflowSchema = {
    name: "gtm_workflow",
    description: `Executes GTM Agent System workflows for tag replication between workspaces.

Actions:
- analyze: Analyze source workspace tags and build dependency graph
- replicate: Replicate tags from source to target workspace (full workflow)
- status: Get current workflow status

This tool uses the multi-agent system (AnalyzerAgent, NamingAgent, PlannerAgent, BuilderAgent, ValidatorAgent) to automatically:
1. Analyze dependencies between tags, triggers, variables
2. Apply naming patterns from target workspace
3. Plan creation order respecting dependencies
4. Create entities in correct order
5. Validate created entities`,
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                description: "The workflow action to perform",
                enum: ["analyze", "replicate", "status"]
            },
            sessionId: {
                type: "string",
                description: "Unique session ID for tracking workflow state. Required for all actions."
            },
            sourceAccountId: {
                type: "string",
                description: "Source GTM Account ID. Required for 'analyze' and 'replicate' actions."
            },
            sourceContainerId: {
                type: "string",
                description: "Source GTM Container ID. Required for 'analyze' and 'replicate' actions."
            },
            sourceWorkspaceId: {
                type: "string",
                description: "Source GTM Workspace ID. Required for 'analyze' and 'replicate' actions."
            },
            targetAccountId: {
                type: "string",
                description: "Target GTM Account ID. Required for 'replicate' action."
            },
            targetContainerId: {
                type: "string",
                description: "Target GTM Container ID. Required for 'replicate' action."
            },
            targetWorkspaceId: {
                type: "string",
                description: "Target GTM Workspace ID. Required for 'replicate' action."
            },
            tagIds: {
                type: "string",
                description: "Comma-separated list of tag IDs to analyze/replicate (e.g., '123,456,789'). Required for 'analyze' and 'replicate' actions."
            },
            includeAllDependencies: {
                type: "boolean",
                description: "Whether to include all dependencies (triggers, variables, templates). Default: true",
                default: true
            },
            skipNaming: {
                type: "boolean",
                description: "Skip naming pattern analysis. Default: false",
                default: false
            },
            skipValidation: {
                type: "boolean",
                description: "Skip validation after creation. Default: false",
                default: false
            },
            dryRun: {
                type: "boolean",
                description: "If true, only plan without creating. Default: false",
                default: false
            },
            namePrefix: {
                type: "string",
                description: "Prefix to add to entity names (e.g., '[COPY] ')"
            },
            nameSuffix: {
                type: "string",
                description: "Suffix to add to entity names (e.g., ' v2')"
            }
        },
        required: ["action", "sessionId"]
    }
};
