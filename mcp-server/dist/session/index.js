/**
 * Session Context Management
 * 현재 선택된 Account/Container/Workspace를 저장하는 세션 컨텍스트
 */
// ==================== Session State ====================
let sessionContext = {
    accountId: null,
    accountName: null,
    containerId: null,
    containerName: null,
    containerPublicId: null,
    workspaceId: null,
    workspaceName: null,
};
// ==================== Getters ====================
export const getSessionContext = () => sessionContext;
export const getAccountId = (args) => {
    const id = args.accountId || sessionContext.accountId;
    if (!id) {
        throw new Error("accountId가 필요합니다. gtm_context로 먼저 환경을 설정하거나, accountId를 직접 전달하세요.");
    }
    return id;
};
export const getContainerId = (args) => {
    const id = args.containerId || sessionContext.containerId;
    if (!id) {
        throw new Error("containerId가 필요합니다. gtm_context로 먼저 환경을 설정하거나, containerId를 직접 전달하세요.");
    }
    return id;
};
export const getWorkspaceId = (args) => {
    const id = args.workspaceId || sessionContext.workspaceId;
    if (!id) {
        throw new Error("workspaceId가 필요합니다. gtm_context로 먼저 환경을 설정하거나, workspaceId를 직접 전달하세요.");
    }
    return id;
};
// Optional getters (won't throw if missing)
export const getOptionalWorkspaceId = (args) => {
    return args.workspaceId || sessionContext.workspaceId || null;
};
export const getOptionalContainerId = (args) => {
    return args.containerId || sessionContext.containerId || null;
};
// ==================== Setters ====================
export const setSessionContext = (updates) => {
    sessionContext = { ...sessionContext, ...updates };
};
export const clearSessionContext = () => {
    sessionContext = {
        accountId: null,
        accountName: null,
        containerId: null,
        containerName: null,
        containerPublicId: null,
        workspaceId: null,
        workspaceName: null,
    };
};
// ==================== Formatters ====================
export const formatContextStatus = () => {
    if (!sessionContext.accountId) {
        return "컨텍스트가 설정되지 않았습니다. gtm_context action='set'으로 환경을 설정하세요.";
    }
    let status = `현재 컨텍스트:\n`;
    status += `- Account: ${sessionContext.accountName || sessionContext.accountId} (${sessionContext.accountId})\n`;
    if (sessionContext.containerId) {
        status += `- Container: ${sessionContext.containerName || sessionContext.containerId}`;
        if (sessionContext.containerPublicId) {
            status += ` [${sessionContext.containerPublicId}]`;
        }
        status += ` (${sessionContext.containerId})\n`;
    }
    if (sessionContext.workspaceId) {
        status += `- Workspace: ${sessionContext.workspaceName || sessionContext.workspaceId} (${sessionContext.workspaceId})\n`;
    }
    return status;
};
