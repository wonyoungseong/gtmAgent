# GTM Agent Project

이 프로젝트는 Google Tag Manager를 관리하는 MCP 서버입니다.

---

## 핵심 원칙

> 🚨 **Sub-Agent는 AskUserQuestion 도구에 접근할 수 없습니다!**
>
> 모든 사용자 질문은 **메인 Claude가 AskUserQuestion으로 처리**해야 합니다.

---

## GTM 작업 처리 방법 (Add Event)

### Step 1: 환경 선택 (메인 Claude)

```javascript
// 1. GTM 데이터 수집 (병렬)
mcp__gtm__gtm_account({ action: "list" })
mcp__gtm__gtm_container({ action: "list", accountId: "..." })
mcp__gtm__gtm_workspace({ action: "list", accountId, containerId })

// 2. AskUserQuestion (환경 선택 - 4개 탭)
// Multi Container 선택 시: Account, Container 복수 선택 가능
AskUserQuestion({
  questions: [
    {
      header: "Scope",
      question: "작업 범위를 선택해주세요",
      options: [
        { label: "Single Container", description: "하나의 컨테이너에서 작업" },
        { label: "Multi Container", description: "여러 컨테이너에 동일 작업 적용" }
      ],
      multiSelect: false
    },
    {
      header: "Account",
      question: "GTM 계정을 선택해주세요",
      options: [...],
      multiSelect: true  // Multi Container 시 여러 계정 선택 가능
    },
    {
      header: "Container",
      question: "컨테이너를 선택해주세요",
      options: [...],
      multiSelect: true  // Multi Container 시 여러 컨테이너 선택 가능
    },
    {
      header: "Workspace",
      question: "워크스페이스를 선택해주세요",
      options: [...],
      multiSelect: false  // 각 컨테이너의 Default Workspace 사용
    }
  ]
})
```

### Step 2: 패턴 분석 및 이벤트 정보 수집 (메인 Claude)

```javascript
// 1. 선택된 환경에서 태그/트리거 조회하여 패턴 추출
mcp__gtm__gtm_tag({ action: "list", accountId, containerId, workspaceId })
mcp__gtm__gtm_trigger({ action: "list", accountId, containerId, workspaceId })

// 태그명에서 category 패턴 추출
// 트리거에서 특수 조건 패턴 추출 (filter 조건이 있는 트리거 확인)

// 2. AskUserQuestion (이벤트 정보)
AskUserQuestion({
  questions: [
    {
      header: "Category",
      question: "event_category를 선택해주세요",
      options: [/* GTM에서 추출한 패턴 */],
      multiSelect: false
    },
    {
      header: "Trigger",
      question: "트리거 방식을 선택해주세요",
      options: [
        { label: "CE - Custom Event (단순)", description: "dataLayer.push만 감지" },
        { label: "CE - Custom Event + 조건", description: "Cookie/변수 조건 포함" },
        { label: "EV - Element Visibility", description: "요소 노출 감지" },
        { label: "CL - Click", description: "클릭 이벤트 감지" },
        { label: "기존 트리거 사용", description: "이미 있는 트리거 선택" }
      ],
      multiSelect: false
    }
  ]
})
```

### Step 3: 특수 트리거 조건 확인 (CE + 조건 선택 시)

> 🚨 **"CE - Custom Event + 조건" 선택 시 반드시 실행**

```javascript
// 1. 기존 조건부 트리거 패턴 조회
mcp__gtm__gtm_trigger({ action: "list", ... })
// filter 조건이 있는 트리거 찾기:
// - CE - Qualified Visit: Cookie 조건
// - CE - Multi Host: Cookie 조건
// - EV - Imported Content 50%: JS 변수 조건

// 2. 기존 변수 조회 (필요한 변수 확인)
mcp__gtm__gtm_variable({ action: "list", ... })

// 3. AskUserQuestion (조건 상세)
AskUserQuestion({
  questions: [
    {
      header: "조건 타입",
      question: "어떤 조건이 필요한가요?",
      options: [
        { label: "Cookie 체크", description: "쿠키 값으로 중복 방지 (예: Qualified Visit)" },
        { label: "변수 체크", description: "JS/DL 변수 값 확인" },
        { label: "기존 패턴 참조", description: "기존 조건부 트리거와 동일" }
      ],
      multiSelect: false
    },
    {
      header: "기존 패턴",
      question: "참조할 기존 트리거를 선택해주세요",
      options: [
        { label: "CE - Qualified Visit", description: "Cookie - BDP Qualified Visit Event Fired" },
        { label: "CE - Multi Host", description: "Cookie - BDP Multi Host Event Fired" },
        { label: "새 조건 생성", description: "직접 조건 정의" }
      ],
      multiSelect: false
    }
  ]
})
```

**조건 생성 시 필요한 변수 확인:**
```
조건: Cookie 체크
→ Cookie 변수 존재 여부 확인
→ 없으면 Cookie 변수 먼저 생성
→ 트리거 filter에 조건 추가
```

### Step 4: Sub-Agent Spawn (실행만)

모든 정보가 수집된 후 Sub-Agent spawn:

```javascript
Task({
  subagent_type: "general-purpose",
  description: "GTM 태그 생성",
  prompt: `
# GTM Agent

## 작업 환경 (선택 완료)
- Account: BETC (6262702160)
- Container: [EC]BETC_Web (202727037)
- Workspace: Default Workspace (36)

## 이벤트 정보 (수집 완료)
- event_name: start_test_gtm
- event_category: ETC
- event_action: Start Test GTM
- trigger: Custom Event (dataLayer)

## 작업 지시
위 정보로 태그를 생성하세요.
- 태그명: GA4 - ETC - Start Test GTM
- 트리거명: CE - start_test_gtm
- **사용자에게 추가 질문하지 말 것!**
- 생성 전 사용자 승인만 받을 것

## 출력 요구사항
생성 완료 후 반드시 다음 정보를 **상세하게** 출력:

1. **생성된 트리거 정보** (테이블)
   - 이름, ID, 타입, 이벤트명

2. **생성된 태그 정보** (테이블)
   - 이름, ID, 타입, 이벤트명, Measurement ID
   - Parameters (event_category, event_action 등)

3. **GTM Links** (클릭 가능한 URL)
   - 트리거 URL
   - 태그 URL

4. **테스트 방법**
   - dataLayer.push 코드 예시

5. **다음 단계**
   - Preview 모드 → DebugView → Publish

## 규칙
- .claude/skills/gtm/SKILL.md의 Output Format 참조
- remove, publish 절대 금지
`
})
```

---

## 감지 키워드

| 키워드 | 작업 |
|--------|------|
| 태그, 트리거, 변수, GTM, GA4 | GTM 작업 |
| 추가, 생성, 만들어 | Add Event |
| 분석, 살펴봐 | Analyze |

---

## 흐름 요약

```
1. 키워드 감지 → GTM 작업 시작
2. 메인 Claude: GTM 데이터 수집 (accounts, containers, workspaces)
3. 메인 Claude: AskUserQuestion (Step 1 - 환경 선택)
4. 메인 Claude: GTM 패턴 분석 (tags, triggers에서 패턴 추출)
5. 메인 Claude: AskUserQuestion (Step 2 - 이벤트 정보)
6. (조건부) CE + 조건 선택 시:
   - 기존 조건부 트리거 패턴 조회
   - 필요 변수 확인
   - AskUserQuestion (Step 3 - 조건 상세)
7. 메인 Claude: Sub-Agent spawn (모든 정보 포함)
8. Sub-Agent: 변수 → 트리거 → 태그 순서로 생성
9. Sub-Agent: 생성 전 사용자 승인
```

---

## Safety Rules

```
⛔ 금지: remove, publish
✅ 허용: list, get, create(승인 후), update(승인 후)
```

---

## References

| 문서 | 내용 |
|------|------|
| [SKILL.md](.claude/skills/gtm/SKILL.md) | 규칙, 도구 |
| [procedures.md](.claude/skills/gtm/resources/procedures.md) | 상세 워크플로우 |
