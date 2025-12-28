# GTM Agent Project

이 프로젝트는 Google Tag Manager를 관리하는 MCP 서버입니다.

---

## GTM 작업 처리 방법

GTM 관련 요청 시 **2단계**로 처리합니다:

### Step 1: 환경 선택 (메인 Claude가 직접 처리)

**메인 Claude가 AskUserQuestion 도구를 호출**하여 환경을 선택받습니다.
(Sub-Agent는 AskUserQuestion 도구에 접근할 수 없음)

```javascript
// 1. GTM 데이터 수집 (병렬)
mcp__gtm__gtm_account({ action: "list" })
mcp__gtm__gtm_container({ action: "list", accountId: "..." })
mcp__gtm__gtm_workspace({ action: "list", accountId: "...", containerId: "..." })

// 2. AskUserQuestion 도구 호출 (4개 탭)
AskUserQuestion({
  questions: [
    {
      header: "Mode",
      question: "작업 모드를 선택해주세요",
      options: [
        { label: "Edit (Recommended)", description: "태그/트리거/변수 생성 및 수정" },
        { label: "Read", description: "조회만 (변경 없음)" }
      ],
      multiSelect: false
    },
    {
      header: "Account",
      question: "GTM 계정을 선택해주세요",
      options: [
        { label: "BETC", description: "ID: 6262702160" },
        { label: "serverSideTest", description: "ID: 6293242161" }
      ],
      multiSelect: false
    },
    {
      header: "Container",
      question: "컨테이너를 선택해주세요",
      options: [
        { label: "[EC]BETC_Web", description: "Web | ID: 202727037" },
        { label: "[EC]BETC_VUE_WEB", description: "Web | ID: 205824856" }
      ],
      multiSelect: false
    },
    {
      header: "Workspace",
      question: "워크스페이스를 선택해주세요",
      options: [
        { label: "Default Workspace", description: "기본 워크스페이스" },
        { label: "새 워크스페이스 생성", description: "새로운 워크스페이스를 만듭니다" }
      ],
      multiSelect: false
    }
  ]
})
```

### Step 2: Sub-Agent Spawn (선택된 환경으로)

환경이 선택되면 Sub-Agent를 spawn하여 실제 작업 수행:

```javascript
Task({
  subagent_type: "general-purpose",
  description: "GTM 태그 관리",
  prompt: `
# GTM Agent

당신은 **GTM Agent**입니다.

## 작업 환경 (이미 선택됨)
- Account: ${selectedAccount}
- Container: ${selectedContainer}
- Workspace: ${selectedWorkspace}
- Mode: ${selectedMode}

## 사용자 요청
${userRequest}

## 규칙
1. 위 환경에서 작업 수행 (환경 선택 질문 하지 말 것!)
2. .claude/skills/gtm/SKILL.md 참조하여 워크플로우 실행
3. 생성/수정 전 반드시 사용자 승인
4. remove, publish 액션 절대 금지
`
})
```

---

## 감지 키워드

| 키워드 | 작업 유형 |
|--------|-----------|
| GTM, 태그, 트리거, 변수 | GTM 관련 |
| GA4, 이벤트, dataLayer | 분석 태그 |
| 추가, 생성, 만들어 | 생성 작업 |
| 분석, 살펴봐, 현황 | 분석 작업 |

---

## 예시 흐름

### 사용자 요청
```
> start_test 태그를 추가해줘
```

### 메인 Claude 처리
1. GTM 키워드 감지
2. gtm_account, gtm_container, gtm_workspace 호출로 데이터 수집
3. **AskUserQuestion 도구 호출** → 4개 탭 UI 표시
4. 사용자가 환경 선택
5. 선택된 환경 정보와 함께 Sub-Agent spawn
6. Sub-Agent가 태그 생성 작업 수행

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
