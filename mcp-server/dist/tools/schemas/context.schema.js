/**
 * gtm_context Tool Schema
 * GTM 작업 환경(컨텍스트) 관리
 */
export const gtmContextSchema = {
    name: "gtm_context",
    description: `GTM 작업 환경(컨텍스트)을 관리합니다. 한 번 설정하면 이후 모든 도구 호출에서 accountId/containerId/workspaceId를 생략할 수 있습니다.

**권장 워크플로우:**
1. gtm_context action='set' → Account/Container/Workspace 선택
2. 이후 gtm_tag, gtm_trigger 등 호출 시 ID 생략 가능

**액션:**
- 'get': 현재 설정된 컨텍스트 조회
- 'set': 컨텍스트 설정 (accountId 필수, containerId/workspaceId 선택)
- 'clear': 컨텍스트 초기화`,
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["get", "set", "clear"],
                description: "get: 현재 컨텍스트 조회, set: 컨텍스트 설정, clear: 컨텍스트 초기화",
            },
            accountId: {
                type: "string",
                description: "GTM Account ID. 'set' action에서 필수.",
            },
            containerId: {
                type: "string",
                description: "GTM Container ID. 'set' action에서 선택.",
            },
            workspaceId: {
                type: "string",
                description: "GTM Workspace ID. 'set' action에서 선택. containerId가 있어야 설정 가능.",
            },
        },
        required: ["action"],
    },
};
