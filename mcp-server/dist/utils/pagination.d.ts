export declare const DEFAULT_PAGE_SIZE = 20;
export declare const SUMMARY_SAMPLE_SIZE = 5;
export declare const CACHE_TTL_MS: number;
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
export declare function paginateArray<T>(items: T[], page?: number, itemsPerPage?: number): PaginationResult<T>;
export declare function processVersionData(versionData: Record<string, unknown>, resourceType?: string, page?: number, itemsPerPage?: number, includeSummary?: boolean): Record<string, unknown>;
