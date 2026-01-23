export const DEFAULT_PAGE_SIZE = 20;
export const SUMMARY_SAMPLE_SIZE = 5;
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    returned: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextPage: number | null;
    previousPage: number | null;
  };
}

export function paginateArray<T>(
  items: T[],
  page: number = 1,
  itemsPerPage: number = DEFAULT_PAGE_SIZE
): PaginationResult<T> {
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
export function processVersionData(
  versionData: Record<string, unknown>,
  resourceType?: string,
  page: number = 1,
  itemsPerPage: number = DEFAULT_PAGE_SIZE,
  includeSummary: boolean = false
) {
  const {
    tag,
    trigger,
    variable,
    folder,
    builtInVariable,
    zone,
    customTemplate,
    client,
    gtagConfig,
    transformation,
    ...baseVersion
  } = versionData as Record<string, unknown[]>;

  // Summary counts
  const summary = {
    tagCount: (tag as unknown[])?.length || 0,
    triggerCount: (trigger as unknown[])?.length || 0,
    variableCount: (variable as unknown[])?.length || 0,
    folderCount: (folder as unknown[])?.length || 0,
    builtInVariableCount: (builtInVariable as unknown[])?.length || 0,
    zoneCount: (zone as unknown[])?.length || 0,
    customTemplateCount: (customTemplate as unknown[])?.length || 0,
    clientCount: (client as unknown[])?.length || 0,
    gtagConfigCount: (gtagConfig as unknown[])?.length || 0,
    transformationCount: (transformation as unknown[])?.length || 0,
  };

  // If no resourceType, return summary + samples (preview mode)
  if (!resourceType) {
    return {
      version: baseVersion,
      summary,
      // Sample: 미리보기용 (전체 데이터는 resourceType 지정해서 조회)
      tagSample: (tag as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
      triggerSample: (trigger as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
      variableSample: (variable as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
      folderSample: (folder as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
      builtInVariableSample: (builtInVariable as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
      zoneSample: (zone as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
      customTemplateSample: (customTemplate as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
      clientSample: (client as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
      gtagConfigSample: (gtagConfig as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
      transformationSample: (transformation as unknown[])?.slice(0, SUMMARY_SAMPLE_SIZE),
    };
  }

  // Get the requested resource and paginate (full data access)
  const resourceMap: Record<string, unknown[]> = {
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

  const result: Record<string, unknown> = {
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
