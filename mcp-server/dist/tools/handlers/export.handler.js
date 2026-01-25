/**
 * GTM Export Handler
 */
import { createTextResult } from "../types.js";
import { getAccountId, getContainerId, getWorkspaceId } from "../../session/index.js";
import * as fs from "fs";
import * as path from "path";
export const handleGtmExportFull = async (tagmanager, args) => {
    const accountId = getAccountId(args);
    const containerId = getContainerId(args);
    const versionType = args.versionType;
    const outputPath = args.outputPath;
    let versionData;
    if (versionType === "live") {
        const response = await tagmanager.accounts.containers.versions.live({
            parent: `accounts/${accountId}/containers/${containerId}`,
        });
        versionData = response.data;
    }
    else if (versionType === "workspace") {
        const workspaceId = args.workspaceId || getWorkspaceId(args);
        if (!workspaceId)
            throw new Error("workspaceId is required for workspace export");
        const workspacePath = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
        // Fetch all resources from workspace in parallel
        const [workspaceRes, containerRes, tagsRes, triggersRes, variablesRes, foldersRes, builtInVariablesRes, customTemplatesRes, clientsRes, zonesRes, transformationsRes,] = await Promise.all([
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
    }
    else {
        const containerVersionId = args.containerVersionId;
        if (!containerVersionId)
            throw new Error("containerVersionId is required for specific version export");
        const response = await tagmanager.accounts.containers.versions.get({
            path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
        });
        versionData = response.data;
    }
    // Build summary
    const container = versionData.container;
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
        tagCount: versionData.tag?.length || 0,
        triggerCount: versionData.trigger?.length || 0,
        variableCount: versionData.variable?.length || 0,
        folderCount: versionData.folder?.length || 0,
        builtInVariableCount: versionData.builtInVariable?.length || 0,
        customTemplateCount: versionData.customTemplate?.length || 0,
        clientCount: versionData.client?.length || 0,
        zoneCount: versionData.zone?.length || 0,
        transformationCount: versionData.transformation?.length || 0,
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
        return createTextResult({
            success: true,
            message: "GTM container exported successfully",
            outputPath,
            fileSizeKB,
            summary,
        });
    }
    // Without outputPath, return full data inline
    return createTextResult({ summary, fullData: versionData });
};
