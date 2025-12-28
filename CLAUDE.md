# GTM Agent Project

이 프로젝트는 Google Tag Manager를 관리하는 MCP 서버입니다.

---

## GTM Sub-Agent 사용

GTM 관련 요청이 들어오면 **반드시 Task tool로 Sub-Agent를 spawn**하세요.

### 감지 키워드

다음 키워드가 포함된 요청은 GTM Sub-Agent로 처리:

| 키워드 | 작업 유형 |
|--------|-----------|
| GTM, 태그, 트리거, 변수 | GTM 관련 |
| GA4, 이벤트, dataLayer | 분석 태그 |
| 추가, 생성, 만들어 | 생성 작업 |
| 분석, 살펴봐, 현황 | 분석 작업 |
| 검색, 찾아, 어디 | 검색 작업 |
| 수정, 변경, 업데이트 | 수정 작업 |
| 검증, 확인, 체크 | 검증 작업 |
| 디버그, 추적, 왜 | 디버깅 작업 |
| 내보내기, 백업, export | 내보내기 |

### Sub-Agent Spawn 방법

```javascript
Task({
  subagent_type: "general-purpose",
  description: "GTM 태그 관리",
  prompt: `
# GTM Agent

당신은 **GTM Agent**입니다. Google Tag Manager 전문 Sub-Agent로서 태그, 트리거, 변수를 관리합니다.

## 사용자 요청
${userRequest}

## 🚨 최우선 규칙: AskUserQuestion 도구 사용 필수

환경 선택 시 **절대로 텍스트 테이블을 출력하지 마세요!**
반드시 **AskUserQuestion 도구**를 호출해야 합니다.

❌ 금지 (텍스트 출력):
| 옵션 | 계정명 | Account ID |
|------|--------|------------|

✅ 필수 (도구 호출):
AskUserQuestion({
  questions: [
    { header: "Mode", question: "작업 모드 선택", options: [...], multiSelect: false },
    { header: "Account", question: "계정 선택", options: [...], multiSelect: false },
    { header: "Container", question: "컨테이너 선택", options: [...], multiSelect: false },
    { header: "Workspace", question: "워크스페이스 선택", options: [...], multiSelect: false }
  ]
})

## 워크플로우
1. GTM MCP 도구로 데이터 수집 (gtm_account, gtm_container, gtm_workspace 병렬 호출)
2. **AskUserQuestion 도구 호출**로 4개 탭 환경 선택 (텍스트 출력 금지!)
3. 선택된 환경에서 작업 수행
4. 생성/수정 전 사용자 승인

## MCP 도구 사용 규칙
- list, get: 자유롭게 사용
- create, update: 사용자 승인 후에만
- remove, publish: 절대 금지

## 참조 파일
- .claude/skills/gtm/SKILL.md (상세 워크플로우)
`
})
```

---

## 예시

### 사용자 요청
```
> start_test 태그를 추가해줘
```

### Claude 응답
```javascript
// GTM 키워드 감지 → Sub-Agent spawn
Task({
  subagent_type: "general-purpose",
  description: "GTM start_test 태그 추가",
  prompt: `위의 Sub-Agent Spawn 방법 참조`
})
```

### Sub-Agent가 해야 할 일
1. gtm_account, gtm_container, gtm_workspace로 데이터 수집
2. **AskUserQuestion 도구 호출** (텍스트 테이블 출력 금지!)
3. 사용자 선택 후 태그 생성 진행

---

## Golden Rules (빠른 참조)

```
0. ENVIRONMENT FIRST - 환경 선택 최우선
1. PARSE FIRST - 항상 GTM 분석 먼저
2. PATTERNS FROM GTM - GTM에서 패턴 추출
3. ASK EVENT INFO - event_name, event_category, event_action 수집
4. NAMING BY CATEGORY - event_category 기반 태그 네이밍
5. 3-LAYER CHECK - 중복 체크 필수
6. ES5 ONLY - ES5 코드만
7. CONFIRM WITH USER - 사용자 승인 후 생성
```

---

## MCP Safety

```
⛔ 절대 금지:
- gtm_workspace(action: "remove")
- gtm_container(action: "remove")
- gtm_tag(action: "remove")
- gtm_trigger(action: "remove")
- gtm_variable(action: "remove")
- gtm_version(action: "publish")

✅ 허용 (사용자 승인 후):
- create, update 액션들
```

---

## 참조 문서

| 문서 | 내용 |
|------|------|
| [SKILL.md](mcp-server/skills/gtm/SKILL.md) | 워크플로우, MCP 도구 사용법 |
| [naming-convention.md](mcp-server/skills/gtm/resources/references/naming-convention.md) | 태그 네이밍 규칙 |
| [procedures.md](mcp-server/skills/gtm/resources/procedures.md) | 상세 절차 |
