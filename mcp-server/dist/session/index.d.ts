/**
 * Session Context Management
 * 현재 선택된 Account/Container/Workspace를 저장하는 세션 컨텍스트
 */
export interface SessionContext {
    accountId: string | null;
    accountName: string | null;
    containerId: string | null;
    containerName: string | null;
    containerPublicId: string | null;
    workspaceId: string | null;
    workspaceName: string | null;
}
export declare const getSessionContext: () => SessionContext;
export declare const getAccountId: (args: Record<string, unknown>) => string;
export declare const getContainerId: (args: Record<string, unknown>) => string;
export declare const getWorkspaceId: (args: Record<string, unknown>) => string;
export declare const getOptionalWorkspaceId: (args: Record<string, unknown>) => string | null;
export declare const getOptionalContainerId: (args: Record<string, unknown>) => string | null;
export declare const setSessionContext: (updates: Partial<SessionContext>) => void;
export declare const clearSessionContext: () => void;
export declare const formatContextStatus: () => string;
