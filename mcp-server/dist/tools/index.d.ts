export declare function registerAllTools(): ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            config?: undefined;
            destinationId?: undefined;
            createOrUpdateConfig?: undefined;
            fingerprint?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            page?: undefined;
            itemsPerPage?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            config: {
                type: string;
                description: string;
            };
            containerId?: undefined;
            workspaceId?: undefined;
            destinationId?: undefined;
            createOrUpdateConfig?: undefined;
            fingerprint?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            page?: undefined;
            itemsPerPage?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            destinationId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            combineConfig: {
                type: string;
                description: string;
            };
            moveTagIdConfig: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                description: string;
                default: number;
            };
            itemsPerPage: {
                type: string;
                description: string;
                default: number;
                maximum?: undefined;
            };
            workspaceId?: undefined;
            config?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            entity: {
                type: string;
                description: string;
            };
            changeStatus: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                description?: undefined;
                maximum?: undefined;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            tagId: {
                type: string;
                description: string;
                items?: undefined;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description: string;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description: string;
            };
            refresh: {
                type: string;
                default: boolean;
                description: string;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            triggerId: {
                type: string;
                description: string;
                items?: undefined;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            refresh: {
                type: string;
                default: boolean;
                description: string;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            variableId: {
                type: string;
                description: string;
                items?: undefined;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            refresh: {
                type: string;
                default: boolean;
                description: string;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            triggerId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            containerVersionId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            resourceType: {
                type: string;
                enum: string[];
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            includeSummary: {
                type: string;
                default: boolean;
                description: string;
            };
            workspaceId?: undefined;
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                description: string;
            };
            types: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            pageToken: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            config?: undefined;
            destinationId?: undefined;
            createOrUpdateConfig?: undefined;
            fingerprint?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            clientId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            destinationId: {
                type: string;
                description: string;
            };
            allowUserPermissionFeatureUpdate: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            workspaceId?: undefined;
            config?: undefined;
            createOrUpdateConfig?: undefined;
            fingerprint?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            environmentId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            workspaceId?: undefined;
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            folderId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            tagId: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            triggerId: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            variableId: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            refresh?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            gtagConfigId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            templateId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            transformationId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            userPermissionId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            containerId?: undefined;
            workspaceId?: undefined;
            config?: undefined;
            destinationId?: undefined;
            fingerprint?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            includeDeleted: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            workspaceId?: undefined;
            config?: undefined;
            destinationId?: undefined;
            createOrUpdateConfig?: undefined;
            fingerprint?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            zoneId: {
                type: string;
                description: string;
            };
            createOrUpdateConfig: {
                type: string;
                description: string;
            };
            fingerprint: {
                type: string;
                description: string;
            };
            page: {
                type: string;
                default: number;
                description?: undefined;
            };
            itemsPerPage: {
                type: string;
                default: number;
                maximum: number;
                description?: undefined;
            };
            config?: undefined;
            destinationId?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            accountId: {
                type: string;
                description: string;
            };
            containerId: {
                type: string;
                description: string;
            };
            versionType: {
                type: string;
                enum: string[];
                description: string;
            };
            containerVersionId: {
                type: string;
                description: string;
            };
            workspaceId: {
                type: string;
                description: string;
            };
            outputPath: {
                type: string;
                description: string;
            };
            action?: undefined;
            config?: undefined;
            destinationId?: undefined;
            createOrUpdateConfig?: undefined;
            fingerprint?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            page?: undefined;
            itemsPerPage?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action?: undefined;
            accountId?: undefined;
            containerId?: undefined;
            workspaceId?: undefined;
            config?: undefined;
            destinationId?: undefined;
            createOrUpdateConfig?: undefined;
            fingerprint?: undefined;
            combineConfig?: undefined;
            moveTagIdConfig?: undefined;
            page?: undefined;
            itemsPerPage?: undefined;
            entity?: undefined;
            changeStatus?: undefined;
            tagId?: undefined;
            refresh?: undefined;
            triggerId?: undefined;
            variableId?: undefined;
            containerVersionId?: undefined;
            resourceType?: undefined;
            includeSummary?: undefined;
            type?: undefined;
            types?: undefined;
            pageToken?: undefined;
            clientId?: undefined;
            allowUserPermissionFeatureUpdate?: undefined;
            environmentId?: undefined;
            folderId?: undefined;
            gtagConfigId?: undefined;
            templateId?: undefined;
            transformationId?: undefined;
            userPermissionId?: undefined;
            includeDeleted?: undefined;
            zoneId?: undefined;
            versionType?: undefined;
            outputPath?: undefined;
        };
        required: never[];
    };
})[];
export declare function handleToolCall(name: string, args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
