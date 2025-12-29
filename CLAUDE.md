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
// 무료 계정: 최대 3개 제한
// → AskUserQuestion으로 선택 받기
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

<references>
| 문서 | 용도 |
|------|------|
| mcp-server/skills/gtm/SKILL.md | Sub-Agent 규칙 |
| mcp-server/skills/gtm/resources/procedures.md | 상세 절차 |
</references>
