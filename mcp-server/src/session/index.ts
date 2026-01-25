/**
 * Session Context Management
 * 현재 선택된 Account/Container/Workspace를 저장하는 세션 컨텍스트
 */

// ==================== Session Context Interface ====================

export interface SessionContext {
  accountId: string | null;
  accountName: string | null;
  containerId: string | null;
  containerName: string | null;
  containerPublicId: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
}

// ==================== Session State ====================

let sessionContext: SessionContext = {
  accountId: null,
  accountName: null,
  containerId: null,
  containerName: null,
  containerPublicId: null,
  workspaceId: null,
  workspaceName: null,
};

// ==================== Getters ====================

export const getSessionContext = (): SessionContext => sessionContext;

export const getAccountId = (args: Record<string, unknown>): string => {
  const id = (args.accountId as string) || sessionContext.accountId;
  if (!id) {
    throw new Error(
      "accountId가 필요합니다. gtm_context로 먼저 환경을 설정하거나, accountId를 직접 전달하세요."
    );
  }
  return id;
};

export const getContainerId = (args: Record<string, unknown>): string => {
  const id = (args.containerId as string) || sessionContext.containerId;
  if (!id) {
    throw new Error(
      "containerId가 필요합니다. gtm_context로 먼저 환경을 설정하거나, containerId를 직접 전달하세요."
    );
  }
  return id;
};

export const getWorkspaceId = (args: Record<string, unknown>): string => {
  const id = (args.workspaceId as string) || sessionContext.workspaceId;
  if (!id) {
    throw new Error(
      "workspaceId가 필요합니다. gtm_context로 먼저 환경을 설정하거나, workspaceId를 직접 전달하세요."
    );
  }
  return id;
};

// Optional getters (won't throw if missing)
export const getOptionalWorkspaceId = (args: Record<string, unknown>): string | null => {
  return (args.workspaceId as string) || sessionContext.workspaceId || null;
};

export const getOptionalContainerId = (args: Record<string, unknown>): string | null => {
  return (args.containerId as string) || sessionContext.containerId || null;
};

// ==================== Setters ====================

export const setSessionContext = (updates: Partial<SessionContext>): void => {
  sessionContext = { ...sessionContext, ...updates };
};

export const clearSessionContext = (): void => {
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

export const formatContextStatus = (): string => {
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
