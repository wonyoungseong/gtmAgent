# Pre-Add Validation Reference

## 목적

중복 수집 방지 및 기존 설정 충돌 검토

## 중복의 정의

```
중복 수집 발생 조건:
  ① 동일 Trigger 조건 (customEventFilter의 이벤트명)
  + ② 동일 GA4 eventName (태그 parameter에서 추출)
  + ③ 동일 measurementId (같은 GA4 Property)

→ 세 조건이 모두 충족되면 실제 중복 수집 발생
```

## 체크 포인트

| 위치 | 필드 | 예시 | 용도 |
|------|------|------|------|
| **Trigger** | `customEventFilter[].parameter[arg1].value` | "view_item_list" | dataLayer 이벤트명 |
| **Tag** | `parameter[key="eventName"].value` | "view_item_list" | GA4 전송 이벤트명 |
| **Tag** | `parameter[key="measurementIdOverride"].value` | "{{GA4 - MeasurementID}}" | 전송 대상 Property |
| **Tag** | `parameter[key="eventSettingsVariable"].value` | "{{GT - Event Settings}}" | 공통 파라미터 (GA4) |
| **Tag** | `parameter[key="eventConfig"].value` | "{{GT - Event Settings}}" | 공통 파라미터 (Firebase/App) |
| **Tag** | `parameter[key="eventSettingsTable"].list` | [...] | 개별 이벤트 파라미터 |
| **Tag** | `parameter[key="eventData"].list` | [...] | 개별 이벤트 파라미터 (App) |

## Validation Logic

```python
def check_existing_event(event_name, target_measurement_id=None):
    """이벤트 추가 전 기존 설정 검증"""

    findings = {
        "existing_triggers": [],
        "existing_tags": [],
        "duplicate_risks": [],
        "recommendations": []
    }

    # 1. 트리거 검색
    all_triggers = gtm_trigger(action: list, all pages)
    for trigger in all_triggers:
        if trigger.type == "customEvent":
            trigger_event = extract_trigger_event(trigger.customEventFilter)
            if matches_event(trigger_event, event_name):
                findings["existing_triggers"].append({
                    "id": trigger.triggerId,
                    "name": trigger.name,
                    "dataLayer_event": trigger_event
                })

    # 2. 태그 검색
    all_tags = gtm_tag(action: list, all pages)
    for tag in all_tags:
        if tag.type == "gaawe" or tag.type.startswith("cvt_"):
            ga4_event = extract_param(tag.parameter, "eventName")
            measurement_id = extract_param(tag.parameter, "measurementIdOverride")

            if matches_event(ga4_event, event_name):
                findings["existing_tags"].append({
                    "id": tag.tagId,
                    "name": tag.name,
                    "type": tag.type,
                    "ga4_eventName": ga4_event,
                    "measurementId": measurement_id,
                    "firingTriggerId": tag.firingTriggerId
                })

    # 3. 중복 수집 리스크 분석
    for existing_tag in findings["existing_tags"]:
        for existing_trigger in findings["existing_triggers"]:
            if existing_trigger["id"] in existing_tag["firingTriggerId"]:
                same_property = (
                    target_measurement_id is None or
                    existing_tag["measurementId"] == target_measurement_id
                )
                if same_property:
                    findings["duplicate_risks"].append({
                        "type": "FULL_DUPLICATE",
                        "severity": "HIGH",
                        "message": "동일 조건 + 동일 이벤트 + 동일 Property"
                    })

    return findings
```

## Validation Report Format

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Pre-Add Validation Report: {event_name}              │
├─────────────────────────────────────────────────────────┤
│ 기존 트리거:                                             │
│   ⚠️ CE - View Item List (ID: 14)                       │
│      → 이벤트: view_item_list                           │
├─────────────────────────────────────────────────────────┤
│ 기존 태그:                                               │
│   ⚠️ GA4 - View Item List (ID: 46)                      │
│      → 트리거: CE - View Item List                      │
│   ⚠️ GA4 - View Item List(for App) (ID: 148)            │
│      → 트리거: CE - View Item List                      │
├─────────────────────────────────────────────────────────┤
│ 🚨 중복 리스크: HIGH                                     │
│   동일 이벤트가 이미 구성되어 있음                        │
├─────────────────────────────────────────────────────────┤
│ 💡 권장사항:                                             │
│   1. 기존 설정 사용 권장                                 │
│   2. 수정이 필요하면 기존 태그 업데이트                   │
└─────────────────────────────────────────────────────────┘
```

## Configuration Audit

```python
def audit_configuration(tags, triggers, variables, inventory):
    """기존 GTM 설정 검증"""

    issues = []

    # 1. 고아 트리거 (연결된 태그 없음)
    # 2. 이벤트명 불일치 (트리거 ≠ 태그 GA4 이벤트)
    # 3. 누락된 변수 참조
    # 4. 중복 태그 (동일 트리거 + 동일 GA4 이벤트)
    # 5. Ecommerce 필수 파라미터 누락

    return issues
```

## Ecommerce 필수 파라미터

| 이벤트 | 필수 파라미터 |
|--------|-------------|
| view_item_list | items, item_list_name |
| view_item | items |
| add_to_cart | items, value, currency |
| purchase | items, value, currency, transaction_id |

## Code Standards (ES5)

**⚠️ GTM은 ECMAScript 5 (ES5) 기준으로 코드 작성 필수**

### 금지 문법 (ES6+)

| 문법 | 예시 | ES5 대안 |
|------|------|----------|
| `const`, `let` | `const x = 1` | `var x = 1` |
| Arrow function | `() => {}` | `function() {}` |
| Template literal | `` `Hello ${name}` `` | `'Hello ' + name` |
| Destructuring | `var {a, b} = obj` | `var a = obj.a; var b = obj.b` |
| Spread operator | `[...arr]` | `arr.slice()` |
| Default params | `function(a = 1)` | `a = a || 1` |
| Class | `class Foo {}` | `function Foo() {}` |
| async/await | `async function()` | callback 패턴 |
| for...of | `for (x of arr)` | `for (var i = 0; i < arr.length; i++)` |
| Object shorthand | `{a, b}` | `{a: a, b: b}` |

### Custom JavaScript 변수 예시

```javascript
// ❌ ES6+ (동작 안함)
function() {
  const items = {{DLV - ecommerce.items}};
  return items?.map(item => item.item_id) ?? [];
}

// ✅ ES5 (올바른 방식)
function() {
  var items = {{DLV - ecommerce.items}};
  if (!items) return [];
  var result = [];
  for (var i = 0; i < items.length; i++) {
    result.push(items[i].item_id);
  }
  return result;
}
```

### try-catch 필수 사용

**⚠️ 여러 스크립트 동시 실행 시 오류로 인한 전체 중단 방지**

```javascript
// ❌ try-catch 없음 (오류 발생 시 후속 스크립트 중단)
<script>
  var element = document.querySelector('.target');
  element.click();  // element가 없으면 오류 → 전체 중단
</script>

// ✅ try-catch 사용 (오류 발생해도 다른 스크립트 계속 실행)
<script>
  try {
    var element = document.querySelector('.target');
    if (element) {
      element.click();
    }
  } catch (e) {
    // 오류 무시 또는 로깅
  }
</script>
```

### Custom HTML 태그 템플릿

```html
<script>
  try {
    // 실제 로직
    var data = {{DLV - ecommerce}};
    if (data && data.items) {
      // 처리 로직
    }
  } catch (e) {
    // 오류 발생 시 처리 (선택)
    // console.error('GTM Error:', e);
  }
</script>
```

### 검증 체크리스트

Custom HTML/JavaScript 코드 작성 시:
- [ ] `const`, `let` 대신 `var` 사용
- [ ] Arrow function 대신 `function` 키워드 사용
- [ ] Template literal 대신 문자열 연결 사용
- [ ] Optional chaining (`?.`) 대신 명시적 null 체크
- [ ] Nullish coalescing (`??`) 대신 `||` 또는 조건문 사용
- [ ] **Custom HTML 태그에 try-catch 구문 적용**
