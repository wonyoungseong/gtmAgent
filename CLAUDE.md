# GTM Agent Project

이 프로젝트는 Google Tag Manager를 관리하는 MCP 서버입니다.

---

## 핵심 원칙

> 🚨 **Sub-Agent는 AskUserQuestion 도구에 접근할 수 없습니다!**
>
> 모든 사용자 질문은 **메인 Claude가 AskUserQuestion으로 처리**해야 합니다.

---

## GTM 작업 처리 방법 (Add Event)

### Step 1: 환경 선택 (메인 Claude) - 2단계

```javascript
// Step 1-1: Account + Container 선택
mcp__gtm__gtm_account({ action: "list" })
mcp__gtm__gtm_container({ action: "list", accountId: "..." })  // 모든 계정의 컨테이너

AskUserQuestion({
  questions: [
    { header: "Account", question: "GTM 계정을 선택해주세요", options: [...], multiSelect: false },
    { header: "Container", question: "컨테이너를 선택해주세요", options: [...], multiSelect: false }
  ]
})

// Step 1-2: Workspace 선택 (Container 선택 후)
mcp__gtm__gtm_workspace({ action: "list", accountId, containerId })  // 선택된 컨테이너의 워크스페이스

AskUserQuestion({
  questions: [
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
      question: "event_action을 입력/선택해주세요 (소문자)",
      options: [
        { label: "start_test_gtm", description: "event_name 기반 추천" },
        { label: "직접 입력", description: "Other 선택" }
      ],
      multiSelect: false
    },
    {
      header: "Trigger",
      question: "트리거 방식을 선택해주세요",
      options: [
        { label: "CE - dataLayer.push", description: "단순 Custom Event" },
        { label: "EV - Element Visibility", description: "요소 노출 감지" },
        { label: "CL - Click/Link Click", description: "클릭 이벤트" },
        { label: "복잡한 구현 필요", description: "구현 방식 논의 (Step 2.5)" },
        { label: "기존 트리거 사용", description: "이미 있는 트리거" }
      ],
      multiSelect: false
    }
  ]
})
```

### Step 2.5: 구현 방식 논의 (복잡한 구현 필요 선택 시)

> 🚨 **"복잡한 구현 필요" 선택 시에만 실행**

```javascript
// 1. GTM 기존 패턴 분석
mcp__gtm__gtm_trigger({ action: "list", ... })  // 복잡한 트리거 패턴
mcp__gtm__gtm_variable({ action: "list", ... }) // 관련 변수
mcp__gtm__gtm_tag({ action: "list", ... })      // Custom HTML 태그

// 2. 구현 방식 논의
AskUserQuestion({
  questions: [
    {
      header: "구현 유형",
      question: "어떤 구현 방식이 필요한가요?",
      options: [
        { label: "Cookie 기반 조건", description: "Qualified Visit 패턴 (중복 방지)" },
        { label: "Flag 변수 활용", description: "JS/DL 변수로 상태 관리" },
        { label: "복합 조건 트리거", description: "여러 조건 AND/OR 조합" },
        { label: "Custom HTML 연동", description: "HTML 태그에서 이벤트 발생" }
      ],
      multiSelect: false
    }
  ]
})

// 3. 세부 논의 (구현 유형에 따라)
// Cookie 기반 → 쿠키명, 만료 조건
// Flag 변수 → 변수 타입, 초기값, 변경 조건
// 복합 조건 → 조건 목록, 연산자
// Custom HTML → HTML 코드 위치, dataLayer 구조
```

**구현 유형별 필요 사항:**

| 유형 | 필요 구성요소 | 예시 |
|------|--------------|------|
| Cookie 기반 | Cookie 변수 + 트리거 filter | Qualified Visit (1회만 발동) |
| Flag 변수 | JS/DL 변수 + 조건 체크 | 특정 상태에서만 발동 |
| 복합 조건 | 다중 filter + 변수 조합 | URL + Cookie + 시간 조건 |
| Custom HTML | HTML 태그 + dataLayer.push | 외부 스크립트 연동 |

### Step 3: 구현 세부 설정

> 🚨 **Step 2.5에서 구현 유형 선택 후 실행**

```javascript
// 구현 유형에 따라 필요한 추가 질문
AskUserQuestion({
  questions: [
    // Cookie 기반 선택 시
    {
      header: "Cookie 설정",
      question: "Cookie 조건을 설정해주세요",
      options: [
        { label: "기존 패턴 사용", description: "Qualified Visit 등 기존 패턴" },
        { label: "새 Cookie 정의", description: "새로운 Cookie 조건 생성" }
      ],
      multiSelect: false
    }
    // 또는 Flag 변수 선택 시
    // {
    //   header: "Flag 변수",
    //   question: "Flag 변수 타입을 선택해주세요",
    //   options: [...]
    // }
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
- event_category: etc (소문자, GTM 패턴 따름)
- event_action: start_test_gtm (소문자, GTM 패턴 따름)
- trigger: Custom Event (dataLayer)

## 작업 지시
위 정보로 태그를 생성하세요.
- 태그명: GA4 - Etc - Start Test Gtm (Title Case로 변환)
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
├─ Level 1-1: Account + Container
├─ Level 1-2: Workspace (Container 선택 후)
├─ Level 2: 이벤트 정보 (Category, Action, Trigger)
├─ Level 2.5: 구현 방식 논의 (복잡한 구현 필요 시)
└─ Level 3: 구현 세부 설정 (Step 2.5 선택에 따라)

1. event_name 추출 → 자동 분류 (Basic/Ecommerce/Custom)
2. GTM 데이터 수집 (accounts, containers)
3. AskUserQuestion (Account + Container)
4. GTM workspace 조회 (선택된 container)
5. AskUserQuestion (Workspace)
6. GTM 패턴 분석 + 자동 분류 결과
7. AskUserQuestion (Category + Action + Trigger)
8. (조건부) 복잡한 구현 필요 시:
   ├─ Step 2.5: 구현 방식 논의 (Cookie/Flag/복합/HTML)
   └─ Step 3: 구현 세부 설정
9. Sub-Agent spawn → 변수 → 트리거 → 태그 생성

Trigger 유형:
├─ CE - dataLayer.push (단순)
├─ EV - Element Visibility
├─ CL - Click/Link Click
├─ 복잡한 구현 필요 → Step 2.5
└─ 기존 트리거 사용
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
