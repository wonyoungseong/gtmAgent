/**
 * Common Types for GTM MCP Tools
 */
// ==================== Helper Functions ====================
export const createTextResult = (data) => ({
    content: [
        {
            type: "text",
            text: JSON.stringify(data, null, 2),
        },
    ],
});
export const createErrorResult = (message, error) => ({
    content: [
        {
            type: "text",
            text: JSON.stringify({
                error: message,
                details: error instanceof Error ? error.message : String(error),
            }, null, 2),
        },
    ],
});
export const paginateArray = (arr, page, itemsPerPage) => {
    const totalItems = arr.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const data = arr.slice(startIndex, endIndex);
    return {
        data,
        pagination: {
            page,
            itemsPerPage,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        },
    };
};
// ==================== Page Size Constants ====================
export const PAGE_SIZES = {
    TAG: 20,
    TRIGGER: 20,
    VARIABLE: 20,
    TEMPLATE: 20,
    ZONE: 20,
    VERSION: 20,
    DEFAULT: 50,
};
