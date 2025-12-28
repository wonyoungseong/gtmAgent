export const DEFAULT_PAGE_SIZE = 20;
export function paginateArray(items, page = 1, itemsPerPage = DEFAULT_PAGE_SIZE) {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const data = items.slice(startIndex, endIndex);
    return {
        data,
        pagination: {
            currentPage,
            itemsPerPage,
            totalItems,
            totalPages,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1,
        },
    };
}
// Process version data with optional pagination
export function processVersionData(versionData, resourceType, page = 1, itemsPerPage = DEFAULT_PAGE_SIZE) {
    const { tag, trigger, variable, folder, builtInVariable, zone, customTemplate, client, gtagConfig, transformation, ...baseVersion } = versionData;
    // Summary counts
    const summary = {
        tagCount: tag?.length || 0,
        triggerCount: trigger?.length || 0,
        variableCount: variable?.length || 0,
        folderCount: folder?.length || 0,
        builtInVariableCount: builtInVariable?.length || 0,
        zoneCount: zone?.length || 0,
        customTemplateCount: customTemplate?.length || 0,
        clientCount: client?.length || 0,
        gtagConfigCount: gtagConfig?.length || 0,
        transformationCount: transformation?.length || 0,
    };
    // If no resourceType, return summary only (no pagination needed for summary)
    if (!resourceType) {
        return {
            version: baseVersion,
            summary,
        };
    }
    // Get the requested resource and paginate
    const resourceMap = {
        tag: tag || [],
        trigger: trigger || [],
        variable: variable || [],
        folder: folder || [],
        builtInVariable: builtInVariable || [],
        zone: zone || [],
        customTemplate: customTemplate || [],
        client: client || [],
        gtagConfig: gtagConfig || [],
        transformation: transformation || [],
    };
    const items = resourceMap[resourceType] || [];
    const paginatedResult = paginateArray(items, page, itemsPerPage);
    return {
        version: baseVersion,
        summary,
        [resourceType]: paginatedResult.data,
        [`${resourceType}Pagination`]: paginatedResult.pagination,
    };
}
