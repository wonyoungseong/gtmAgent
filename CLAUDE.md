# GTM Agent Project

이 프로젝트는 Google Tag Manager를 관리하는 MCP 서버입니다.

<important>
Sub-Agent는 AskUserQuestion 도구에 접근할 수 없습니다.
모든 사용자 질문은 메인 Claude가 AskUserQuestion으로 처리하세요.
</important>

<workflow name="Add Event">

<step number="1" title="환경 선택 (메인 Claude)">
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

<tag_analysis_rules>
## 태그 분석 시 필수 확인 사항

### 1. Tag Sequencing (Setup Tag / Cleanup Tag) 반드시 확인
태그의 실행 흐름을 파악할 때 **firingTriggerId만으로는 불완전**합니다.
반드시 다음을 함께 확인하세요:

| 속성 | 설명 | 확인 방법 |
|------|------|-----------|
| `firingTriggerId` | 직접 연결된 트리거 | 태그 조회 시 확인 |
| `setupTag` | 이 태그 실행 **전에** 실행되는 태그 | 태그 조회 시 확인 |
| `teardownTag` | 이 태그 실행 **후에** 실행되는 태그 (Cleanup) | 태그 조회 시 확인 |

### 2. 태그 연결 구조 파악 프로세스
```javascript
// 1. 태그 목록 조회
gtm_tag({ action: "list", ... })

// 2. 각 태그의 setupTag, teardownTag 확인
for (tag of tags) {
  if (tag.setupTag) {
    // 이 태그는 다른 태그의 Setup으로 실행됨
    console.log(tag.name + " → Setup: " + tag.setupTag.map(t => t.tagName))
  }
  if (tag.teardownTag) {
    // 이 태그 실행 후 Cleanup 태그가 실행됨
    console.log(tag.name + " → Cleanup: " + tag.teardownTag.map(t => t.tagName))
  }
}
```

### 3. 트리거가 없는 태그 주의
`firingTriggerId`가 없는 태그는 **다른 태그의 Setup/Cleanup으로만 실행**됩니다.
이런 태그를 발견하면 어떤 태그에서 참조하는지 반드시 역추적하세요.

### 4. 실행 흐름 예시
```
[Trigger 발동]
      ↓
[Setup Tag] (있으면 먼저 실행)
      ↓
[Main Tag] (본 태그 실행)
      ↓
[Cleanup Tag] (있으면 나중에 실행)
```

### 5. 분석 보고 시 포함할 정보
태그 분석 결과를 보고할 때 반드시 다음을 포함:
- 직접 트리거 (firingTriggerId)
- Setup Tag 연결 여부
- Cleanup Tag 연결 여부
- 이 태그를 참조하는 다른 태그 (역방향 참조)
</tag_analysis_rules>

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

<references>
| 문서 | 용도 |
|------|------|
| mcp-server/skills/gtm/SKILL.md | Sub-Agent 규칙 |
| mcp-server/skills/gtm/resources/procedures.md | 상세 절차 |
</references>
