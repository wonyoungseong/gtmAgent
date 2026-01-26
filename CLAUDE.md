# GTM Agent Project

이 프로젝트는 Google Tag Manager를 관리하는 MCP 서버입니다.

<important>
Sub-Agent는 AskUserQuestion 도구에 접근할 수 없습니다.
모든 사용자 질문은 메인 Claude가 AskUserQuestion으로 처리하세요.
</important>

<context_setup>
## 컨텍스트 설정 (필수 - 모든 GTM 작업 전에 실행)

GTM 작업을 시작하기 전에 **반드시 gtm_context로 환경을 먼저 설정**하세요.
한 번 설정하면 이후 모든 도구 호출에서 accountId/containerId/workspaceId를 생략할 수 있습니다.

### 워크플로우
```javascript
// 1. Account 목록 조회
gtm_account({ action: "list" })
// → AskUserQuestion으로 Account 선택

// 2. Container 목록 조회
gtm_container({ action: "list", accountId: "선택된ID" })
// → AskUserQuestion으로 Container 선택

// 3. Workspace 목록 조회
gtm_workspace({ action: "list", accountId: "...", containerId: "..." })
// → AskUserQuestion으로 Workspace 선택

// 4. 컨텍스트 설정 (한 번만 실행)
gtm_context({
  action: "set",
  accountId: "선택된ID",
  containerId: "선택된ID",
  workspaceId: "선택된ID"
})

// 5. 이후 모든 도구 호출에서 ID 생략 가능!
gtm_tag({ action: "list" })  // accountId, containerId, workspaceId 자동 사용
gtm_trigger({ action: "list" })
gtm_variable({ action: "list" })
```

### 컨텍스트 확인/초기화
```javascript
// 현재 컨텍스트 확인
gtm_context({ action: "get" })

// 컨텍스트 초기화 (다른 컨테이너로 전환 시)
gtm_context({ action: "clear" })
```
</context_setup>

<workflow name="Add Event">

<step number="1" title="환경 선택 및 컨텍스트 설정 (메인 Claude)">
1-1. Account + Container 선택
```javascript
gtm_account({ action: "list" })
gtm_container({ action: "list", accountId: "..." })
// → AskUserQuestion으로 선택 받기
```

1-2. Workspace 선택 (Container 선택 후)
```javascript
gtm_workspace({ action: "list", accountId, containerId })

// 워크스페이스 개수에 따른 분기 처리
if (workspaces.length < 3) {
  // 3개 미만: "새 Workspace 생성" 옵션 포함
  AskUserQuestion({
    question: "워크스페이스를 선택해주세요",
    options: [
      ...existingWorkspaces,
      { label: "새 Workspace 생성", description: "새로운 워크스페이스 생성" }
    ]
  })
} else {
  // 3개 제한 도달: 경고 메시지 + 기존 워크스페이스만 표시
  AskUserQuestion({
    question: "⚠️ 워크스페이스 제한(3개) 도달. 기존 워크스페이스를 선택하세요.",
    options: [...existingWorkspaces]  // 생성 옵션 없음
  })
}
```

1-3. **컨텍스트 설정 (Workspace 선택 후 필수!)**
```javascript
// 선택된 환경을 컨텍스트에 저장
gtm_context({
  action: "set",
  accountId: "선택된accountId",
  containerId: "선택된containerId",
  workspaceId: "선택된workspaceId"
})
// 이후 모든 gtm_tag, gtm_trigger 등에서 ID 생략 가능
```
</step>

<step number="2" title="이벤트 정보 수집 (메인 Claude)">
GTM 패턴 분석 후 AskUserQuestion으로 한번에 수집:

| 항목 | 설명 |
|------|------|
| Category | event_category 값 |
| Action | event_action 값 |
| Trigger Event | dataLayer에서 감지할 event명 |
| GA4 Event | GA4에 전송할 eventName |
| Trigger Type | CE/EV/CL 중 선택 |
| Tag Type | GA4/AD/HTML 중 선택 |
| Event Settings | 기존 변수 사용 여부 (GA4 선택 시) |
</step>

<step number="3" title="Sub-Agent Spawn">
모든 정보 수집 완료 후 Sub-Agent에게 생성 위임:

```javascript
Task({
  subagent_type: "general-purpose",
  description: "GTM 태그 생성",
  prompt: `
# GTM Agent

## 환경
- Account: {name} ({accountId})
- Container: {name} ({containerId})
- Workspace: {name} ({workspaceId})

## 이벤트 정보
- event_action: {action}
- event_category: {category}
- trigger_event_name: {trigger_event}
- ga4_event_name: {ga4_event}
- trigger_type: {CE/EV/CL}
- tag_type: {GA4/AD/HTML}
- event_settings: {변수명 또는 null}

## 태그명 결정 (필수!)
if (ga4_event_name === "custom_event") {
  태그명 = "GA4 - Custom Event - {Category} - {Action}"
} else if (tag_type === "AD") {
  태그명 = "AD - {Platform} - {Event}"
} else {
  태그명 = "GA4 - {Category} - {Action}"
}

## 규칙
- SKILL.md 참조 필수
- 생성 후 workspace description 업데이트
- 사용자에게 추가 질문하지 않기
`
})
```
</step>

</workflow>

<tag_naming_patterns>
| 조건 | 패턴 | 예시 |
|------|------|------|
| GA4 일반 | `GA4 - {Category} - {Action}` | GA4 - ETC - Start Camera |
| GA4 custom_event | `GA4 - Custom Event - {Category} - {Action}` | GA4 - Custom Event - BTS - Start Test |
| AD | `AD - {Platform} - {Event}` | AD - Meta - Purchase |
| HTML | `HTML - {Description}` | HTML - Set Cookie Flag |
</tag_naming_patterns>

<safety_rules>
- list, get: 자유롭게 사용
- create, update: 사용자 승인 후 실행
- remove, publish: 사용하지 마세요
</safety_rules>

<migration_workflow>
## Migration/Replication Workflow (gtm_workflow 도구 사용 강제!)

<critical>
⛔ **절대 금지**: Migration/Replication 작업 시 MCP 도구 직접 호출
⛔ gtm_tag, gtm_trigger, gtm_variable을 반복 호출하면 토큰 낭비!
⛔ 수동으로 의존성 추적하지 마세요!

✅ **반드시 gtm_workflow MCP 도구 사용**
✅ 1회 호출로 전체 워크플로우 자동 실행
✅ 토큰 사용량 90% 절감
</critical>

### gtm_workflow 도구 사용법

**1단계: 분석 (선택사항)**
```javascript
gtm_workflow({
  action: "analyze",
  sessionId: "unique-session-id",
  sourceAccountId: "6207024013",
  sourceContainerId: "172990757",
  sourceWorkspaceId: "114",
  tagIds: "599,604,588",  // 분석할 태그 ID (쉼표 구분)
  includeAllDependencies: true
})
// → 의존성 그래프, 필요한 변수/트리거 목록 반환
```

**2단계: 복제 실행**
```javascript
gtm_workflow({
  action: "replicate",
  sessionId: "unique-session-id",
  sourceAccountId: "6207024013",
  sourceContainerId: "172990757",
  sourceWorkspaceId: "114",
  targetAccountId: "6277920445",
  targetContainerId: "210926331",
  targetWorkspaceId: "45",
  tagIds: "599,604,588,601,634,609,590",
  includeAllDependencies: true,
  dryRun: false  // true면 시뮬레이션만
})
// → 자동으로 모든 의존성 포함 생성
```

**3단계: 상태 확인**
```javascript
gtm_workflow({
  action: "status",
  sessionId: "unique-session-id"
})
```

### 내부 자동 실행 Agent
| Agent | 역할 |
|-------|------|
| AnalyzerAgent | 의존성 자동 추적 (teardown, setup, 변수, 트리거) |
| NamingAgent | TARGET 패턴 분석 및 네이밍 적용 |
| PlannerAgent | 중복 체크, 생성 순서 계획 |
| BuilderAgent | 올바른 순서로 엔티티 생성 |
| ValidatorAgent | 결과 검증, 참조 무결성 확인 |

### 금지 패턴 (토큰 낭비!)
```
❌ gtm_tag({ action: "get", tagId: "599" })
❌ gtm_tag({ action: "get", tagId: "604" })
❌ gtm_trigger({ action: "get", triggerId: "..." })
❌ ... 반복 호출로 수십 번 API 요청

위 패턴 감지 시 → 즉시 중단하고 gtm_workflow 사용!
```

### 허용 패턴
```
✅ gtm_workflow({ action: "replicate", ... })  // 1회 호출
✅ 결과 확인 후 사용자에게 요약 제공
```
</migration_workflow>

<cache_rules>
## 캐시 자동 갱신 규칙

MCP 서버는 태그/트리거/변수 목록을 캐시합니다.

### 반드시 refresh: true 사용해야 하는 상황
| 감지 키워드 | 조치 |
|------------|------|
| "방금 수정했어", "GTM에서 변경" | `refresh: true` |
| "최신 데이터", "새로고침" | `refresh: true` |
| create/update 직후 list 호출 | `refresh: true` |
| 사용자가 예상과 다른 결과 언급 | `refresh: true` |

```javascript
// 예시: 사용자가 "방금 GTM에서 수정했어"
gtm_tag({ action: "list", ..., refresh: true })

// 예시: 태그 생성 후 목록 재조회
await gtm_tag({ action: "create", ... });
gtm_tag({ action: "list", ..., refresh: true });

// 캐시 수동 초기화
gtm_cache({ action: "clear", accountId, containerId, workspaceId })
```
</cache_rules>

<summary_templates>
## 요약 템플릿 선택 규칙 (중요!)

GTM 작업 후 요약/설명 작성 시 **용도에 맞는 템플릿**을 선택해야 합니다.

### 템플릿 종류

| 용도 | 템플릿 파일 | 사용 시점 |
|------|------------|----------|
| **Jira 배포 요청** | `skills/gtm-reviewer-summary.md` | 검토자/확인자에게 운영 배포 승인 요청 시 |
| **GTM Workspace Description** | `skills/gtm/resources/references/workspace.md` | GTM 내부 버전 관리용 설명 작성 시 |

### 키워드 기반 자동 판단

```
사용자 요청에 포함된 키워드:
├─ "Jira", "배포 요청", "운영 배포", "검토자", "확인자", "description 배포"
│   └─ → gtm-reviewer-summary.md 사용
├─ "workspace description", "버전 설명", "GTM 설명"
│   └─ → workspace.md 참조
└─ 불명확한 경우
    └─ → 반드시 AskUserQuestion으로 확인!
```

### 불명확할 때 질문 (필수!)

```javascript
AskUserQuestion({
  question: "어떤 용도의 요약을 원하시나요?",
  header: "요약 용도",
  options: [
    {
      label: "Jira 배포 요청용",
      description: "검토자/확인자에게 전달할 운영 배포 요청 요약"
    },
    {
      label: "GTM Workspace Description",
      description: "GTM 내부 버전 관리용 간결한 설명"
    }
  ]
})
```

### Jira 배포 요청 형식 예시

```
GTM Container: [EC] INNISFREE - KR

Work Space Name: qualifiedVisitScrollDepth50

Work Space URL: https://tagmanager.google.com/#/container/accounts/.../workspaces/...

수정 내용:
- CE - Ap Scroll 50% (트리거 이벤트명 변경)
- HTML - Push Qualified Visit Event (이벤트 라벨 값 변경: 90% -> 50%)
```

### GTM Workspace Description 형식 예시

```
이름: "JIRA-456 start_camera"
설명: "Ticket: JIRA-456 | 작업: start_camera 이벤트 추가 | 상세: CE trigger + GA4 tags | 2024-12-28"
```
</summary_templates>

<references>
| 문서 | 용도 |
|------|------|
| mcp-server/skills/gtm/SKILL.md | Sub-Agent 규칙 |
| mcp-server/skills/gtm/resources/procedures.md | 상세 절차 |
| mcp-server/skills/gtm-reviewer-summary.md | Jira 배포 요청용 요약 |
| mcp-server/skills/gtm/resources/references/workspace.md | GTM Workspace 설명 |
</references>
