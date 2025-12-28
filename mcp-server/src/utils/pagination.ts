export const DEFAULT_PAGE_SIZE = 20;

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
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
export function processVersionData(
  versionData: Record<string, unknown>,
  resourceType?: string,
  page: number = 1,
  itemsPerPage: number = DEFAULT_PAGE_SIZE
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

  // If no resourceType, return summary only (no pagination needed for summary)
  if (!resourceType) {
    return {
      version: baseVersion,
      summary,
    };
  }

  // Get the requested resource and paginate
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

  return {
    version: baseVersion,
    summary,
    [resourceType]: paginatedResult.data,
    [`${resourceType}Pagination`]: paginatedResult.pagination,
  };
}
