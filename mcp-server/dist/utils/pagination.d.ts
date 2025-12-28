export declare const DEFAULT_PAGE_SIZE = 20;
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
export declare function paginateArray<T>(items: T[], page?: number, itemsPerPage?: number): PaginationResult<T>;
export declare function processVersionData(versionData: Record<string, unknown>, resourceType?: string, page?: number, itemsPerPage?: number): {
    version: {
        [x: string]: unknown[];
    };
    summary: {
        tagCount: number;
        triggerCount: number;
        variableCount: number;
        folderCount: number;
        builtInVariableCount: number;
        zoneCount: number;
        customTemplateCount: number;
        clientCount: number;
        gtagConfigCount: number;
        transformationCount: number;
    };
};
