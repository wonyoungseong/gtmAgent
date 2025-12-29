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

### Step 2: AskUserQuestion 도구 호출 (4개 탭)

```javascript
AskUserQuestion({
  questions: [
    {
      header: "Account",
      question: "GTM 계정을 선택해주세요",
      options: [/* 조회된 계정 목록 */],
      multiSelect: false
    },
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
      header: "Container",
      question: "컨테이너를 선택해주세요",
      options: [/* 조회된 컨테이너 목록 */],
      multiSelect: true  // Multi Container 선택 시 여러 개 선택 가능
    },
    {
      header: "Workspace",
      question: "워크스페이스를 선택해주세요",
      options: [/* 조회된 워크스페이스 목록 */],
      multiSelect: false
    }
  ]
})
```

> 🚨 텍스트 테이블 출력 금지! 반드시 AskUserQuestion 도구 호출

---

## Add Event (태그 추가)

### Phase 1: GTM 패턴 분석

> 🚨 **추측 금지!** GTM에서 실제 패턴 추출

```javascript
// 1. 기존 GA4 태그 조회
gtm_tag(action: "list", accountId, containerId, workspaceId)

// 2. 태그명에서 event_category 추출
// "GA4 - Start Diagnosis - Popup" → category: "Start Diagnosis"
// "GA4 - Ecommerce - Purchase" → category: "Ecommerce"

// 3. parameter에서 event_category 값 확인
// parameter.key === "event_category" → 값 또는 변수({{...}})

// 4. 트리거에서 event_name 추출
gtm_trigger(action: "list", ...)
// customEventFilter에서 기존 event_name 수집
```

**패턴 추출 결과 예시:**
```
발견된 category: Start Diagnosis(15), Ecommerce(8), Basic Event(5)
발견된 event_name: purchase, view_item, start_camera
```

### Phase 2: 이벤트 정보 수집

GTM에서 추출한 패턴을 옵션으로 제공:

```javascript
AskUserQuestion({
  questions: [
    {
      header: "Category",
      question: "event_category 선택 (기존 패턴 기반)",
      options: [
        { label: "Start Diagnosis", description: "15개 태그에서 사용" },
        { label: "Ecommerce", description: "8개 태그에서 사용" },
        { label: "새 카테고리", description: "직접 입력" }
      ]
    }
  ]
})
```

### Phase 3: 트리거 확인

```javascript
gtm_trigger(action: "list", ...)
// event_name 일치하는 트리거 있으면 사용
// 없으면 생성: CE - {event_name}
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
```

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
| 타입 | 패턴 |
|------|------|
| Custom Event | `CE - {Event}` |
| Page View | `PV - {Desc}` |
| Click | `CL - {Desc}` |

### Variable
| 타입 | 패턴 |
|------|------|
| Data Layer | `DL - {Name}` |
| JavaScript | `JS - {Name}` |
| Constant | `CONST - {Name}` |
