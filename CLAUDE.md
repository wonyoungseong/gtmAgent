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

// 2. AskUserQuestion (환경만 - 트리거 조건 묻지 않음!)
AskUserQuestion({
  questions: [
    { header: "Account", question: "GTM 계정을 선택해주세요", options: [...], multiSelect: false },
    { header: "Container", question: "컨테이너를 선택해주세요", options: [...], multiSelect: false },
    { header: "Workspace", question: "워크스페이스를 선택해주세요", options: [...], multiSelect: false }
  ]
})
```

### Step 2: 이벤트 자동 분류 및 정보 수집 (메인 Claude)

```javascript
// 1. event_name 기반 자동 분류
const eventName = "start_test_gtm"  // 사용자 요청에서 추출

// 자동 분류 로직:
const BASIC_EVENTS = ["page_view", "session_start", "first_visit", "scroll", "click", "file_download"]
const ECOMMERCE_EVENTS = ["purchase", "view_item", "add_to_cart", "remove_from_cart", "begin_checkout", "view_item_list", "select_item", "add_payment_info", "add_shipping_info", "refund"]

let autoCategory = null
if (BASIC_EVENTS.includes(eventName)) {
  autoCategory = "Basic Event"
} else if (ECOMMERCE_EVENTS.includes(eventName)) {
  autoCategory = "Ecommerce"
}

// 2. GTM에서 기존 패턴 조회 (병렬)
mcp__gtm__gtm_tag({ action: "list", ... })      // category 패턴
mcp__gtm__gtm_trigger({ action: "list", ... })  // 기존 트리거 확인

// 3. AskUserQuestion (Category + Action + Trigger 한번에)
// autoCategory가 있으면 확인만, 없으면 선택
AskUserQuestion({
  questions: [
    {
      header: "Category",
      question: autoCategory
        ? `event_category: "${autoCategory}" (자동 분류) 맞나요?`
        : "event_category를 선택해주세요",
      options: autoCategory
        ? [
            { label: autoCategory, description: "자동 분류됨 (Recommended)" },
            { label: "다른 카테고리", description: "직접 선택" }
          ]
        : [/* GTM에서 추출한 기존 카테고리 목록 */],
      multiSelect: false
    },
    {
      header: "Action",
      question: "event_action을 입력/선택해주세요",
      options: [
        { label: "Start Test GTM", description: "event_name 기반 추천" },
        { label: "직접 입력", description: "Other 선택" }
      ],
      multiSelect: false
    },
    {
      header: "Trigger",
      question: "트리거 방식을 선택해주세요",
      options: [
        { label: "CE - 단순 (dataLayer)", description: "dataLayer.push만 감지" },
        { label: "CE - 조건 포함", description: "Cookie/변수 조건 필요" },
        { label: "기존 트리거 사용", description: "이미 있는 트리거" }
      ],
      multiSelect: false
    }
  ]
})
```

### Step 3: 조건 상세 (CE - 조건 포함 선택 시만)

> 🚨 **"CE - 조건 포함" 선택 시에만 실행**

```javascript
// 기존 조건부 트리거 패턴 조회
mcp__gtm__gtm_trigger({ action: "list", ... })  // filter 있는 트리거
mcp__gtm__gtm_variable({ action: "list", ... }) // 필요 변수

AskUserQuestion({
  questions: [
    {
      header: "조건 패턴",
      question: "어떤 조건 패턴을 사용할까요?",
      options: [
        { label: "Qualified Visit 패턴", description: "Cookie 중복 방지" },
        { label: "새 조건 정의", description: "직접 조건 설정" }
      ],
      multiSelect: false
    }
  ]
})
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
질문 레벨 분리:
├─ Level 1: 환경 (Account, Container, Workspace)
├─ Level 2: 이벤트 정보 (Category, Action, Trigger)
└─ Level 3: 조건 상세 (CE - 조건 포함 시만)

1. event_name 추출 → 자동 분류 (Basic/Ecommerce/Custom)
2. GTM 데이터 수집
3. AskUserQuestion (환경만)
4. GTM 패턴 분석 + 자동 분류 결과
5. AskUserQuestion (Category + Action + Trigger 한번에)
6. (조건부) CE - 조건 포함 시 → AskUserQuestion (조건 패턴)
7. Sub-Agent spawn → 변수 → 트리거 → 태그 생성
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
