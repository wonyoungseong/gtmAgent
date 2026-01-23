export const DEFAULT_PAGE_SIZE = 20;
export const SUMMARY_SAMPLE_SIZE = 5;
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5분
export function paginateArray(items, page = 1, itemsPerPage = DEFAULT_PAGE_SIZE) {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const data = items.slice(startIndex, endIndex);
    const hasNextPage = currentPage < totalPages;
    const hasPreviousPage = currentPage > 1;
    return {
        data,
        pagination: {
            currentPage,
            itemsPerPage,
            totalItems,
            totalPages,
            returned: data.length,
            hasNextPage,
            hasPreviousPage,
            nextPage: hasNextPage ? currentPage + 1 : null,
            previousPage: hasPreviousPage ? currentPage - 1 : null,
        },
    };
}
// Process version data with optional pagination
// - resourceType 없으면: summary + sample (미리보기 5개씩)
// - resourceType 있으면: 해당 리소스만 pagination으로 반환 (전체 조회 가능)
export function processVersionData(versionData, resourceType, page = 1, itemsPerPage = DEFAULT_PAGE_SIZE, includeSummary = false) {
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
    // If no resourceType, return summary + samples (preview mode)
    if (!resourceType) {
        return {
            version: baseVersion,
            summary,
            // Sample: 미리보기용 (전체 데이터는 resourceType 지정해서 조회)
            tagSample: tag?.slice(0, SUMMARY_SAMPLE_SIZE),
            triggerSample: trigger?.slice(0, SUMMARY_SAMPLE_SIZE),
            variableSample: variable?.slice(0, SUMMARY_SAMPLE_SIZE),
            folderSample: folder?.slice(0, SUMMARY_SAMPLE_SIZE),
            builtInVariableSample: builtInVariable?.slice(0, SUMMARY_SAMPLE_SIZE),
            zoneSample: zone?.slice(0, SUMMARY_SAMPLE_SIZE),
            customTemplateSample: customTemplate?.slice(0, SUMMARY_SAMPLE_SIZE),
            clientSample: client?.slice(0, SUMMARY_SAMPLE_SIZE),
            gtagConfigSample: gtagConfig?.slice(0, SUMMARY_SAMPLE_SIZE),
            transformationSample: transformation?.slice(0, SUMMARY_SAMPLE_SIZE),
        };
    }
    // Get the requested resource and paginate (full data access)
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
    const result = {
        version: baseVersion,
        [resourceType]: paginatedResult.data,
        [`${resourceType}Pagination`]: paginatedResult.pagination,
    };
    // Add summary if requested
    if (includeSummary) {
        result.summary = summary;
    }
    return result;
}
