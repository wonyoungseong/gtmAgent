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

// ⚠️ 무료 계정: 워크스페이스 최대 3개 제한
const workspaceCount = workspaces.length;

if (workspaceCount < 3) {
  // 3개 미만: "새 Workspace 생성" 옵션 포함
  AskUserQuestion({
    questions: [{
      header: "Workspace",
      question: "워크스페이스를 선택해주세요",
      options: [
        // 기존 Workspace 목록 +
        { label: "새 Workspace 생성", description: "새로운 워크스페이스 생성" }
      ],
      multiSelect: false
    }]
  })
} else {
  // 🚨 3개 제한 도달: 생성 옵션 없이 기존만 표시
  AskUserQuestion({
    questions: [{
      header: "Workspace",
      question: "⚠️ 워크스페이스 제한(3개) 도달. 기존 워크스페이스를 선택하세요",
      options: [
        // 기존 Workspace 목록만 (생성 옵션 없음)
        // 삭제 필요 시: GTM UI에서 직접 삭제 안내
      ],
      multiSelect: false
    }]
  })
}

// "새 Workspace 생성" 선택 시
if (selectedWorkspace === "새 Workspace 생성") {
  // Workspace 이름 입력 받기
  AskUserQuestion({
    questions: [
      {
        header: "Workspace 이름",
        question: "새 워크스페이스 이름을 입력해주세요",
        options: [
          { label: "Add {event_name}", description: "이벤트 추가용 (Recommended)" },
          { label: "직접 입력", description: "Other" }
        ],
        multiSelect: false
      }
    ]
  })

  // Workspace 생성
  mcp__gtm__gtm_workspace({
    action: "create",
    accountId,
    containerId,
    createOrUpdateConfig: {
      name: workspaceName,  // 예: "Add start_camera"
      description: `{event_name} 이벤트 추가 | GTM Agent | {날짜}

목표: {비즈니스 목적}

상세:
- Parameters: {실제 파라미터 값들}
- 트리거 조건: {트리거 filter 조건}
- 특이사항: {변수, 조건 등 특이사항}`

      // 예시 1 (단순):
      // "start_camera 이벤트 추가 | GTM Agent | 2024-12-28
      //
      // 목표: 카메라 기능 사용률 분석
      //
      // 상세:
      // - Parameters: event_category=etc, event_action=start_camera
      // - 트리거 조건: event="start_camera"
      // - 특이사항: 없음"

      // 예시 2 (복잡):
      // "qualified_visit 이벤트 추가 | GTM Agent | 2024-12-28
      //
      // 목표: 자격 있는 방문자 첫 방문 시 1회만 추적
      //
      // 상세:
      // - Parameters: event_category=qualified, event_action=visit
      // - 트리거 조건: event="qualified_visit" AND Cookie="N"
      // - 특이사항: Cookie 조건으로 중복 방지, 변수 Cookie - BDP 사용"
    }
  })
}
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
mcp__gtm__gtm_tag({ action: "list", ... })      // category 패턴 + Tag Type 패턴
mcp__gtm__gtm_trigger({ action: "list", ... })  // 기존 트리거 확인

// 3. Tag Type 패턴 추출 (태그명에서 prefix 분석)
// 태그명 패턴: "{Prefix} - {Category} - {Action}"
// 예시:
//   "GA4 - Start Diagnosis - Popup" → prefix: "GA4"
//   "FB - Conversion - Purchase" → prefix: "FB"
//   "GADS - Remarketing - ViewItem" → prefix: "GADS"
//   "HTML - Custom Script" → prefix: "HTML"
//   "cHTML - Tracking Code" → prefix: "cHTML"
//
// 발견된 prefix들을 카운트하여 옵션 생성:
// 예: GA4(25), FB(5), HTML(3)

const tagTypePrefixes = extractPrefixesFromTags(tags)
// 결과: [{ prefix: "GA4", count: 25 }, { prefix: "FB", count: 5 }, ...]

// 4. AskUserQuestion (Category + Action + Trigger + Tag Type 한번에)
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
    },
    {
      header: "Tag Type",
      question: "태그 타입(prefix)을 선택해주세요",
      options: [
        // GTM 패턴에서 추출한 prefix 목록 (가장 많이 사용된 순)
        // 예: { label: "GA4", description: "25개 태그에서 사용 (Recommended)" }
        //     { label: "FB", description: "5개 태그에서 사용" }
        //     { label: "HTML", description: "3개 태그에서 사용" }
        // + 항상 마지막에:
        { label: "직접 입력", description: "새로운 prefix 입력" }
      ],
      multiSelect: false
    }
  ]
})
```

### Step 2.5-A: 복잡한 구현 논의 (복잡한 구현 필요 선택 시)

> 🚨 **"복잡한 구현 필요" 선택 시에만 실행**
>
> 예시: `qualified_visit` 이벤트는 다음 구성요소가 필요:
> 1. Cookie 변수 (`Cookie - BDP Qualified Visit Event Fired`)
> 2. Custom HTML 태그 (쿠키 설정용)
> 3. 조건부 트리거 (Cookie 체크)
> 4. GA4 이벤트 태그
> 5. Tag Sequencing (태그 발동 순서)

```javascript
// 1. GTM 기존 패턴 분석 (유사한 복잡 구현 찾기)
mcp__gtm__gtm_trigger({ action: "list", ... })  // filter 있는 트리거
mcp__gtm__gtm_variable({ action: "list", ... }) // Cookie, JS 변수
mcp__gtm__gtm_tag({ action: "list", ... })      // Custom HTML 태그

// 2. 유사 패턴 발견 시 제안
// 예: "Qualified Visit 패턴이 이미 있습니다. 동일하게 구현할까요?"

// 3. 필요 구성요소 파악 (다중 선택)
AskUserQuestion({
  questions: [
    {
      header: "구성요소",
      question: "이 이벤트에 필요한 구성요소를 모두 선택해주세요",
      options: [
        { label: "변수 (Variable)", description: "Cookie, JS, Data Layer 변수" },
        { label: "설정 태그 (Setup Tag)", description: "Custom HTML로 쿠키/변수 설정" },
        { label: "조건부 트리거", description: "Cookie, URL 등 조건 포함" },
        { label: "Tag Sequencing", description: "태그 발동 순서 지정" }
      ],
      multiSelect: true  // 🚨 다중 선택!
    }
  ]
})
```

### Step 3: 구성요소별 세부 설정

> 🚨 **Step 2.5-A에서 선택한 각 구성요소에 대해 순차 질문**

#### 3-1. 변수 설정 (Variable 선택 시)

```javascript
// GTM에서 기존 변수 패턴 분석
gtm_variable({ action: "list", ... })
// Cookie 변수: type: "k" (1st Party Cookie)
// JS 변수: type: "jsm" (Custom JavaScript)
// DL 변수: type: "v" (Data Layer Variable)

AskUserQuestion({
  questions: [
    {
      header: "변수 타입",
      question: "필요한 변수 타입을 선택해주세요",
      options: [
        { label: "Cookie 변수", description: "1st Party Cookie 읽기" },
        { label: "JS 변수", description: "Custom JavaScript 실행" },
        { label: "Data Layer 변수", description: "dataLayer에서 값 추출" },
        { label: "기존 변수 사용", description: "이미 있는 변수 활용" }
      ],
      multiSelect: true
    }
  ]
})

// Cookie 변수 선택 시 추가 질문
AskUserQuestion({
  questions: [
    {
      header: "Cookie 이름",
      question: "Cookie 이름을 입력해주세요",
      options: [
        { label: "bdp_{event}_fired", description: "GTM 패턴 따름 (Recommended)" },
        { label: "직접 입력", description: "새 Cookie 이름" }
      ],
      multiSelect: false
    }
  ]
})

// JS 변수 선택 시 추가 질문
AskUserQuestion({
  questions: [
    {
      header: "JS 함수",
      question: "JavaScript 함수 용도를 설명해주세요",
      options: [
        { label: "값 반환", description: "특정 값 계산/반환" },
        { label: "조건 체크", description: "true/false 반환" },
        { label: "DOM 조회", description: "페이지 요소에서 값 추출" },
        { label: "직접 입력", description: "함수 로직 설명" }
      ],
      multiSelect: false
    }
  ]
})
```

#### 3-2. 설정 태그 (Setup Tag 선택 시)

```javascript
// Custom HTML 태그 패턴 분석
gtm_tag({ action: "list", ... })
// type: "html" 인 태그들 확인

AskUserQuestion({
  questions: [
    {
      header: "설정 태그 용도",
      question: "Custom HTML 태그가 무엇을 해야 하나요?",
      options: [
        { label: "Cookie 설정", description: "document.cookie로 쿠키 생성" },
        { label: "변수 설정", description: "window 변수 설정" },
        { label: "dataLayer.push", description: "dataLayer에 데이터 추가" },
        { label: "외부 스크립트", description: "외부 JS 로드/실행" },
        { label: "직접 설명", description: "Other" }
      ],
      multiSelect: true
    }
  ]
})

// Cookie 설정 선택 시
AskUserQuestion({
  questions: [
    {
      header: "Cookie 만료",
      question: "Cookie 만료 조건은?",
      options: [
        { label: "세션", description: "브라우저 닫으면 삭제" },
        { label: "1일", description: "24시간 후 삭제" },
        { label: "7일", description: "일주일 후 삭제" },
        { label: "30일", description: "한달 후 삭제" },
        { label: "직접 입력", description: "Other" }
      ],
      multiSelect: false
    }
  ]
})
```

#### 3-3. 조건부 트리거 (조건부 트리거 선택 시)

```javascript
AskUserQuestion({
  questions: [
    {
      header: "트리거 조건",
      question: "어떤 조건을 체크해야 하나요?",
      options: [
        { label: "Cookie 값 체크", description: "특정 Cookie 값일 때만" },
        { label: "URL 조건", description: "특정 페이지에서만" },
        { label: "Data Layer 값", description: "DL 변수 값 체크" },
        { label: "JS 변수 값", description: "window 변수 체크" },
        { label: "직접 입력", description: "Other" }
      ],
      multiSelect: true
    }
  ]
})

// Cookie 값 체크 선택 시
AskUserQuestion({
  questions: [
    {
      header: "Cookie 조건",
      question: "Cookie 조건을 설정해주세요",
      options: [
        { label: "N일 때 발동", description: "Cookie가 N이면 발동 (1회만)" },
        { label: "Y일 때 발동", description: "Cookie가 Y이면 발동" },
        { label: "없을 때 발동", description: "Cookie 미존재 시 발동" },
        { label: "직접 입력", description: "Other" }
      ],
      multiSelect: false
    }
  ]
})
```

#### 3-4. Tag Sequencing (선택 시)

```javascript
AskUserQuestion({
  questions: [
    {
      header: "태그 순서",
      question: "태그 발동 순서를 설정해주세요",
      options: [
        { label: "Setup → Main", description: "설정 태그 먼저, 그 다음 메인 태그" },
        { label: "Main → Cleanup", description: "메인 태그 후 정리 태그" },
        { label: "Setup → Main → Cleanup", description: "전체 순서 지정" }
      ],
      multiSelect: false
    }
  ]
})
```

**구현 예시 (qualified_visit):**

| 순서 | 구성요소 | 이름 | 설명 |
|------|----------|------|------|
| 1 | 변수 | `Cookie - BDP Qualified Visit Event Fired` | Cookie 값 읽기 |
| 2 | 설정 태그 | `cHTML - Set Qualified Visit Cookie` | Cookie를 Y로 설정 |
| 3 | 트리거 | `CE - Qualified Visit` | event + Cookie=N 조건 |
| 4 | 메인 태그 | `GA4 - Qualified - Visit` | GA4 이벤트 전송 |
| 5 | Sequencing | 메인 태그 → 설정 태그 | 이벤트 후 Cookie 설정 |

### Step 2.5-B: Event Settings Variable 확인 (GA4 선택 시)

> 🚨 **GA4 Event 선택 시에만 실행** (Step 2.5-A와 독립적)

```javascript
// GTM에서 기존 Event Settings Variable 패턴 확인
gtm_variable({ action: "list", ... })
// type: "gtes" (Google Tag Event Settings) 찾기

// 있으면 사용자에게 확인
AskUserQuestion({
  questions: [{
    header: "Event Settings",
    question: "기존 Event Settings Variable을 사용할까요?",
    options: [
      { label: "{{GA4 - Event Settings}}", description: "기존 변수 사용 (Recommended)" },
      { label: "사용 안 함", description: "Event Settings 없이 생성" },
      { label: "새로 생성", description: "새 Event Settings Variable 생성" }
    ],
    multiSelect: false
  }]
})

// 없으면 질문 스킵 (Event Settings 없이 생성)
```

### Step 3: Sub-Agent Spawn (실행만)

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
- workspaceId: 36  ← 🚨 description 업데이트에 필요

## 이벤트 정보 (수집 완료)
- event_name: start_test_gtm
- event_category: etc (소문자, GTM 패턴 따름)
- event_action: start_test_gtm (소문자, GTM 패턴 따름)
- trigger: Custom Event (dataLayer)
- tag_type: GA4  ← GTM 패턴에서 추출 (예: GA4, FB, GADS, HTML, cHTML 등)
- event_settings: {{GA4 - Event Settings}} 또는 null

## 작업 지시
위 정보로 태그를 생성하세요.
- 태그명: GA4 - ETC - Start Test Gtm (Title Case, 약자는 대문자)
- 트리거명: CE - Start Test Gtm (Title Case, 약자는 대문자)
- **사용자에게 추가 질문하지 말 것!**
- 생성 전 사용자 승인만 받을 것

## ⚠️ 네이밍 규칙 (필수)
태그명, 트리거명 모두 Title Case + 약자 대문자:
- snake_case → Title Case: start_test_gtm → Start Test Gtm
- 약자는 대문자: etc → ETC, api → API, cta → CTA, ui → UI

## ⚠️ Tag Type별 태그명 패턴
태그명 패턴: {tag_type} - {Category} - {Action}
- tag_type은 GTM 패턴에서 추출된 prefix 사용 (예: GA4, FB, GADS, HTML, cHTML 등)
- 예시: GA4 - ETC - Start Camera, FB - Conversion - Purchase, cHTML - Tracking Script

## ⚠️ Event Settings Variable 규칙
- event_settings가 null이면: Event Settings 파라미터 설정하지 않음
- event_settings가 있으면: 해당 변수를 eventSettingsVariable로 설정

## 🚨 필수: Workspace Description 업데이트
태그 생성 완료 후 반드시 다음 단계 실행:

\`\`\`javascript
// 1. 현재 workspace 조회 (fingerprint 획득)
gtm_workspace({ action: "get", accountId, containerId, workspaceId })

// 2. description 업데이트
gtm_workspace({
  action: "update",
  accountId,
  containerId,
  workspaceId,
  fingerprint: "현재fingerprint",
  createOrUpdateConfig: {
    description: \`{event_name} 이벤트 추가 | GTM Agent | {날짜}

목표: {비즈니스 목적}

상세:
- Parameters: event_category={값}, event_action={값}
- 트리거 조건: event="{event_name}"
- 특이사항: {변수, 조건 등}\`
  }
})
\`\`\`

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

## 필수 참조 파일 (반드시 읽을 것)
1. .claude/skills/gtm/SKILL.md - Output Format, Golden Rules
2. .claude/skills/gtm/resources/procedures.md - 상세 워크플로우
3. .claude/skills/gtm/resources/references/workspace.md - Workspace 네이밍
4. .claude/skills/gtm/resources/references/naming-convention.md - 태그/트리거 네이밍
5. .claude/skills/gtm/resources/references/validation.md - ES5, 검증

## 규칙
- 위 참조 파일들의 규칙을 반드시 따를 것
- remove, publish 절대 금지
- 🚨 태그 생성 완료 후 반드시 workspace description 업데이트
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
├─ Level 2: 이벤트 정보 (Category, Action, Trigger, Tag Type)
├─ Level 2.5-A: 복잡한 구현 논의 (복잡한 구현 필요 시)
│   └─ 구성요소 선택: 변수, 설정 태그, 조건부 트리거, Tag Sequencing
├─ Level 3: 구성요소별 세부 설정 (2.5-A 선택에 따라)
│   ├─ 3-1: 변수 설정 (Cookie/JS/DL)
│   ├─ 3-2: 설정 태그 (Custom HTML)
│   ├─ 3-3: 조건부 트리거 (Cookie/URL 조건)
│   └─ 3-4: Tag Sequencing (발동 순서)
└─ Level 2.5-B: Event Settings Variable 확인 (GA4 선택 시)

1. event_name 추출 → 자동 분류 (Basic/Ecommerce/Custom)
2. GTM 데이터 수집 (accounts, containers)
3. AskUserQuestion (Account + Container)
4. GTM workspace 조회 (선택된 container)
5. AskUserQuestion (Workspace)
6. GTM 패턴 분석 + 자동 분류 결과 + Tag Type 패턴
7. AskUserQuestion (Category + Action + Trigger + Tag Type)
8. (조건부) 복잡한 구현 필요 시:
   ├─ Step 2.5-A: 구성요소 선택 (변수/설정태그/조건트리거/Sequencing)
   └─ Step 3: 선택된 구성요소별 세부 설정
9. (조건부) GA4 선택 시:
   └─ Step 2.5-B: Event Settings Variable 확인
10. Sub-Agent spawn → 변수 → 설정태그 → 트리거 → 메인태그 → Description 업데이트

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
