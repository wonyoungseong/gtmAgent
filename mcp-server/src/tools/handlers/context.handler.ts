/**
 * GTM Context Handler
 * 세션 컨텍스트 관리
 */

import { tagmanager_v2 } from "googleapis";
import { ToolResult, createTextResult } from "../types.js";
import {
  getSessionContext,
  setSessionContext,
  clearSessionContext,
  formatContextStatus,
} from "../../session/index.js";

export const handleGtmContext = async (
  tagmanager: tagmanager_v2.Tagmanager,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const action = args.action as string;

  switch (action) {
    case "get": {
      return createTextResult({
        context: getSessionContext(),
        status: formatContextStatus(),
      });
    }

    case "set": {
      const accountId = args.accountId as string;
      const containerId = args.containerId as string | undefined;
      const workspaceId = args.workspaceId as string | undefined;

      if (!accountId) {
        throw new Error("accountId는 set 액션에서 필수입니다.");
      }

      // Account 정보 조회
      const accountRes = await tagmanager.accounts.get({
        path: `accounts/${accountId}`,
      });
      setSessionContext({
        accountId,
        accountName: accountRes.data.name || null,
      });

      // Container 정보 조회 (제공된 경우)
      if (containerId) {
        const containerRes = await tagmanager.accounts.containers.get({
          path: `accounts/${accountId}/containers/${containerId}`,
        });
        setSessionContext({
          containerId,
          containerName: containerRes.data.name || null,
          containerPublicId: containerRes.data.publicId || null,
        });
      } else {
        setSessionContext({
          containerId: null,
          containerName: null,
          containerPublicId: null,
        });
      }

      // Workspace 정보 조회 (제공된 경우)
      if (workspaceId && containerId) {
        const workspaceRes = await tagmanager.accounts.containers.workspaces.get({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        });
        setSessionContext({
          workspaceId,
          workspaceName: workspaceRes.data.name || null,
        });
      } else {
        setSessionContext({
          workspaceId: null,
          workspaceName: null,
        });
      }

      return createTextResult({
        success: true,
        message: "컨텍스트가 설정되었습니다.",
        context: getSessionContext(),
        status: formatContextStatus(),
      });
    }

    case "clear": {
      clearSessionContext();
      return createTextResult({
        success: true,
        message: "컨텍스트가 초기화되었습니다.",
      });
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
