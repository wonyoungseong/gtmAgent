# GTM Procedures

## References

| 문서 | 내용 |
|------|------|
| [naming-convention.md](references/naming-convention.md) | 태그/트리거/변수 네이밍 |
| [event-types.md](references/event-types.md) | Type A/B/C 분류 |
| [validation.md](references/validation.md) | ES5, 검증 체크리스트 |
| [duplicate-check.md](references/duplicate-check.md) | 3-Layer 중복 체크 |

---

## Phase 0: 환경 선택 (모든 워크플로우 공통)

> ⚠️ **메인 Claude가 처리** (Sub-Agent는 AskUserQuestion 사용 불가)

### Step 1: 데이터 수집 (병렬)

```javascript
mcp__gtm__gtm_account({ action: "list" })
mcp__gtm__gtm_container({ action: "list", accountId: "..." })
mcp__gtm__gtm_workspace({ action: "list", accountId, containerId })
```

### Step 2: AskUserQuestion (2단계로 분리)

```javascript
// Step 2-1: Account + Container 선택
AskUserQuestion({
  questions: [
    { header: "Account", question: "GTM 계정을 선택해주세요", options: [...], multiSelect: false },
    { header: "Container", question: "컨테이너를 선택해주세요", options: [...], multiSelect: false }
  ]
})

// Container 선택 후 → Workspace 조회
mcp__gtm__gtm_workspace({ action: "list", accountId, containerId })

// Step 2-2: Workspace 선택 (⚠️ 3개 제한 확인 필수)
const workspaceCount = workspaces.length;

if (workspaceCount < 3) {
  // 3개 미만: 생성 옵션 포함
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

// "새 Workspace 생성" 선택 시 → 이름 입력 → gtm_workspace(action: "create")
```

> 🚨 텍스트 테이블 출력 금지! 반드시 AskUserQuestion 도구 호출

---

## Add Event (태그 추가)

### Phase 1: GTM 패턴 분석

> 🚨 **추측 금지!** GTM에서 실제 패턴 추출 → **해당 GTM 패턴 우선**

```javascript
// 1. 기존 GA4 태그 조회
gtm_tag(action: "list", accountId, containerId, workspaceId)

// 2. 태그명에서 event_category 추출
// "GA4 - Start Diagnosis - Popup" → category: "Start Diagnosis"
// "GA4 - Ecommerce - Purchase" → category: "Ecommerce"

// 3. parameter에서 event_category/action 값 + 케이스 패턴 확인
// parameter.key === "event_category" → 값 또는 변수({{...}})
// 케이스 패턴 확인:
//   - snake_case: "start_diagnosis", "popup_impressions"
//   - 단순 소문자: "scroll", "click"
//   - 기타: GTM마다 다를 수 있음

// 4. 트리거에서 event_name 추출
gtm_trigger(action: "list", ...)
// customEventFilter에서 기존 event_name 수집
```

**패턴 추출 결과 예시:**
```
발견된 category: Start Diagnosis(15), Ecommerce(8), Basic Event(5)
발견된 event_name: purchase, view_item, start_camera
케이스 패턴: snake_case (예: start_diagnosis, popup_impressions)
```

> ⚠️ **패턴 우선순위**: 해당 GTM의 기존 패턴 > 일반 규칙

### Phase 2: 이벤트 자동 분류 및 정보 수집

```javascript
// 1. event_name 기반 자동 분류
const BASIC_EVENTS = ["page_view", "session_start", "first_visit", "scroll", "click", "file_download"]
const ECOMMERCE_EVENTS = ["purchase", "view_item", "add_to_cart", "remove_from_cart", "begin_checkout", "view_item_list", "select_item", "add_payment_info", "add_shipping_info", "refund"]

// 자동 분류 결과:
// - Basic Event: page_view, session_start 등
// - Ecommerce: purchase, view_item 등
// - Custom: 그 외 → GTM 패턴에서 category 추출

// 2. Tag Type 패턴 추출 (태그명에서 prefix 분석)
// 태그명 패턴: "{Prefix} - {Category} - {Action}"
// 예시:
//   "GA4 - Start Diagnosis - Popup" → prefix: "GA4"
//   "FB - Conversion - Purchase" → prefix: "FB"
//   "HTML - Custom Script" → prefix: "HTML"
//   "cHTML - Tracking Code" → prefix: "cHTML"
//
// 발견된 prefix들을 카운트: GA4(25), FB(5), HTML(3)

// 3. AskUserQuestion (Category + Action + Trigger + Tag Type 한번에)
AskUserQuestion({
  questions: [
    {
      header: "Category",
      question: "event_category를 확인해주세요",
      options: [
        { label: "자동 분류된 카테고리", description: "(Recommended)" },
        { label: "GTM 패턴 1", description: "기존 태그에서 추출" },
        { label: "직접 입력", description: "Other" }
      ],
      multiSelect: false
    },
    {
      header: "Action",
      question: "event_action을 확인해주세요",
      options: [
        { label: "event_name 기반 추천", description: "(Recommended)" },
        { label: "직접 입력", description: "Other" }
      ],
      multiSelect: false
    },
    {
      header: "Trigger",
      question: "트리거 방식을 선택해주세요",
      options: [
        { label: "CE - 단순 (dataLayer)", description: "dataLayer.push만" },
        { label: "CE - 조건 포함", description: "Cookie/변수 조건" },
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
        //     { label: "cHTML", description: "3개 태그에서 사용" }
        { label: "직접 입력", description: "새로운 prefix 입력" }
      ],
      multiSelect: false
    }
  ]
})

// 3. GA4 선택 시: Event Settings Variable 확인
// GTM에서 기존 Event Settings Variable 조회
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
```

### Phase 3: 트리거 유형 선택

```javascript
gtm_trigger(action: "list", ...)
// event_name 일치하는 트리거 있으면 사용
// 없으면 유형에 맞게 생성

// 트리거 유형:
// - CE - dataLayer.push (단순)
// - EV - Element Visibility
// - CL - Click/Link Click
// - 복잡한 구현 필요 → Phase 3.5
// - 기존 트리거 사용
```

### Phase 3.5: 구현 방식 논의 (복잡한 구현 필요 시)

> 🚨 **"복잡한 구현 필요" 선택 시 반드시 실행**

```javascript
// 1. GTM 기존 패턴 분석
gtm_trigger(action: "list", ...)  // 복잡한 트리거 패턴
gtm_variable(action: "list", ...)  // 관련 변수
gtm_tag(action: "list", ...)       // Custom HTML 태그

// 2. 구현 유형 선택
// - Cookie 기반 조건: Qualified Visit 패턴 (중복 방지)
// - Flag 변수 활용: JS/DL 변수로 상태 관리
// - 복합 조건 트리거: 여러 조건 AND/OR 조합
// - Custom HTML 연동: HTML 태그에서 이벤트 발생
```

**구현 유형별 상세:**

#### 1. Cookie 기반 조건 (Qualified Visit 패턴)
```javascript
// 필요 구성요소:
// - Cookie 변수 (1st Party Cookie)
// - 트리거 filter 조건

// 예: Qualified Visit
{
  customEventFilter: [{ event: "qualified_visit" }],
  filter: [{ variable: "{{Cookie - BDP Qualified Visit Event Fired}}", value: "N" }]
}

// Cookie 변수 생성
gtm_variable(action: "create", {
  name: "Cookie - BDP {Event} Event Fired",
  type: "k",  // 1st Party Cookie
  parameter: [{ key: "name", value: "bdp_{event}_fired" }]
})
```

#### 2. Flag 변수 활용
```javascript
// 필요 구성요소:
// - JavaScript 변수 또는 Data Layer 변수
// - 상태 체크 트리거 조건

// 예: JS 변수로 상태 관리
gtm_variable(action: "create", {
  name: "JS - {Feature} Flag",
  type: "jsm",  // Custom JavaScript
  parameter: [{ key: "javascript", value: "function() { return window.featureFlag || false; }" }]
})

// 트리거에서 Flag 체크
{
  filter: [{ variable: "{{JS - {Feature} Flag}}", value: "true" }]
}
```

#### 3. 복합 조건 트리거
```javascript
// 필요 구성요소:
// - 다중 filter 조건
// - 변수 조합 (URL, Cookie, 시간 등)

// 예: URL + Cookie 조건
{
  filter: [
    { type: "contains", parameter: [
      { key: "arg0", value: "{{Page Path}}" },
      { key: "arg1", value: "/checkout" }
    ]},
    { type: "equals", parameter: [
      { key: "arg0", value: "{{Cookie - User Type}}" },
      { key: "arg1", value: "premium" }
    ]}
  ]
}
```

#### 4. Custom HTML 연동
```javascript
// 필요 구성요소:
// - Custom HTML 태그 (dataLayer.push 포함)
// - Custom Event 트리거

// HTML 태그에서 이벤트 발생:
// <script>
//   dataLayer.push({
//     event: 'custom_event_name',
//     eventData: { ... }
//   });
// </script>

// 해당 이벤트를 받는 트리거 생성
gtm_trigger(action: "create", {
  name: "CE - {custom_event_name}",
  type: "customEvent",
  customEventFilter: [...]
})
```

**구현 순서:**
```
1. 구현 유형 선택 (Cookie/Flag/복합/HTML)
2. 필요 변수 확인 및 생성
3. 트리거 생성 (조건 포함)
4. 태그 생성
5. 테스트 (Preview 모드)
```

### Phase 4: 태그 설정

```javascript
// GA4 Measurement ID 확인
gtm_tag(action: "list", ...)
// type: "gaawc" 태그에서 measurementId 추출
```

### Phase 5: 생성

```javascript
// 1. 3-Layer 중복 체크
gtm_tag(action: "list")      // 태그명
gtm_trigger(action: "list")  // 트리거명
gtm_variable(action: "list") // 변수명

// 2. 사용자 승인

// 3. 순서대로 생성
gtm_variable(action: "create", ...)  // 변수 (필요시)
gtm_trigger(action: "create", ...)   // 트리거
gtm_tag(action: "create", ...)       // 태그

// 4. 워크스페이스 description 업데이트 (생성 내역 기록)
gtm_workspace(action: "get", workspaceId)  // 현재 fingerprint 조회
gtm_workspace(action: "update", workspaceId, fingerprint, {
  description: `{event_name} 이벤트 추가 | GTM Agent | {날짜}

목표: {비즈니스 목적}

상세:
- Parameters: {실제 파라미터 값들}
- 트리거 조건: {트리거 filter 조건}
- 특이사항: {변수, 조건 등 특이사항}`
})

// 예시:
// "start_camera 이벤트 추가 | GTM Agent | 2024-12-28
//
// 목표: 카메라 기능 사용률 분석
//
// 상세:
// - Parameters: event_category=etc, event_action=start_camera
// - 트리거 조건: event="start_camera"
// - 특이사항: 없음"
```

> ⚠️ **태그 생성 후 반드시 워크스페이스 description 업데이트**

---

## Analyze (분석)

### Quick
```javascript
gtm_tag(action: "list", page: 1)
gtm_trigger(action: "list", page: 1)
gtm_variable(action: "list", page: 1)
// 요약: 수량, 패턴
```

### Full
```javascript
// 전체 페이지 순회
// 분석: 네이밍, 폴더, 미사용, 중복
```

### Live
```javascript
gtm_version(action: "live", accountId, containerId)
```

---

## Search (검색)

```javascript
gtm_tag(action: "list")      // name 필터
gtm_trigger(action: "list")  // customEventFilter 검색
gtm_variable(action: "list")
```

---

## Update (수정)

```javascript
// 1. 조회
gtm_tag(action: "get", tagId)

// 2. 사용자 승인

// 3. 수정
gtm_tag(action: "update", tagId, fingerprint, createOrUpdateConfig)
```

---

## Validate (검증)

```javascript
// Naming: "GA4 - {category} - {action}" 패턴
// Unused: 사용 안되는 트리거/변수
// ES5: var, function(){} 사용 확인
```

---

## Export (내보내기)

```javascript
gtm_export_full({
  accountId,
  containerId,
  versionType: "live" | "workspace" | "specific"
})
```

---

## Naming Conventions

### Tag
| 유형 | 패턴 |
|------|------|
| Basic | `GA4 - Basic Event - {Name}` |
| Ecommerce | `GA4 - Ecommerce - {Name}` |
| Business | `GA4 - {category} - {action}` |

### Trigger
| 타입 | 패턴 | 설명 |
|------|------|------|
| Custom Event (단순) | `CE - {Event}` | dataLayer.push만 감지 |
| Custom Event + 조건 | `CE - {Event}` | Cookie/변수 조건 포함 |
| Element Visibility | `EV - {Desc}` | 요소 노출 감지 |
| Click | `CL - {Desc}` | 클릭 이벤트 |
| Link Click | `LC - {Desc}` | 링크 클릭 |
| Form Submission | `FS - {Desc}` | 폼 제출 |
| DOM Ready | `DR - {Desc}` | DOM 준비 완료 |
| Page View | `PV - {Desc}` | 페이지뷰 |
| YouTube Video | `YV - {Desc}` | 유튜브 비디오 |
| Timer | `TM - {Desc}` | 타이머 |
| Scroll Depth | `SD - {Desc}` | 스크롤 깊이 |

---

## Trigger Types (상세)

### CE - Custom Event (단순)
```javascript
// dataLayer.push만 감지
{
  type: "customEvent",
  customEventFilter: [
    { type: "equals", parameter: [
      { key: "arg0", value: "{{_event}}" },
      { key: "arg1", value: "event_name" }
    ]}
  ]
}
```

### CE - Custom Event + 조건
```javascript
// Cookie/변수 조건 포함 (예: Qualified Visit)
{
  type: "customEvent",
  customEventFilter: [
    { type: "equals", parameter: [
      { key: "arg0", value: "{{_event}}" },
      { key: "arg1", value: "qualified_visit" }
    ]}
  ],
  filter: [
    { type: "equals", parameter: [
      { key: "arg0", value: "{{Cookie - BDP Qualified Visit Event Fired}}" },
      { key: "arg1", value: "N" }
    ]}
  ]
}
```
> 필요 변수: Cookie 변수 (`1st Party Cookie` 타입)

### EV - Element Visibility
```javascript
{
  type: "elementVisibility",
  parameter: [
    { key: "selectorType", value: "CSS" },
    { key: "elementSelector", value: ".className" },
    { key: "onScreenRatio", value: "50" },
    { key: "firingFrequency", value: "ONCE_PER_PAGE" },
    { key: "useDomChangeListener", value: "true" }
  ],
  filter: [/* 추가 조건 */]
}
```

### CL - Click / Link Click
```javascript
{
  type: "linkClick",  // 또는 "click"
  filter: [
    { type: "equals", parameter: [
      { key: "arg0", value: "{{Click Classes}}" },
      { key: "arg1", value: "button_class" }
    ]}
  ]
}
```

### Variable
| 타입 | 패턴 |
|------|------|
| Data Layer | `DL - {Name}` |
| JavaScript | `JS - {Name}` |
| Constant | `CONST - {Name}` |
