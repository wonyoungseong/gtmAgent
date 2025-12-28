# Pattern Detection Reference

## Pattern Detection Algorithm

GTM 컨테이너에서 네이밍 패턴을 자동 감지하는 알고리즘입니다.

### 핵심 알고리즘

```python
def detect_pattern(items):
    # 1. 접두사 추출 (구분자 기준 첫 부분)
    prefixes = [item.name.split(separator)[0] for item in items]
    primary_prefix = most_common(prefixes)

    # 2. 구분자 감지
    separators = [" - ", " _ ", "_", "-", ": "]
    detected_separator = find_separator(items)

    # 3. 케이스 감지
    name_parts = [extract_name_part(item) for item in items]
    detected_case = detect_case_style(name_parts)
    # snake_case, Title Case, camelCase, PascalCase, etc.

    # 4. 컨텍스트 수식어 감지
    context_modifiers = detect_context_modifiers(items)
    # Examples: "(for App)", "ETC - ", "BDP"

    # 5. 서브 패턴 감지
    sub_patterns = detect_sub_patterns(items)
    # "GA4 - ETC - {event}" vs "GA4 - {event}"

    return {
        prefix: primary_prefix,
        separator: detected_separator,
        case: detected_case,
        context_modifiers: context_modifiers,
        sub_patterns: sub_patterns,
        confidence: calculate_confidence()
    }
```

---

## Context Modifiers Detection

페이지/환경별 컨텍스트 수식어를 감지합니다.

```python
def detect_context_modifiers(items):
    """페이지/환경별 컨텍스트 수식어 감지"""
    modifiers = {
        "suffix": [],    # (for App), (Mobile), etc.
        "category": [],  # ETC, BDP, AD, etc.
        "page": []       # PDP, Cart, Checkout, etc.
    }

    for item in items:
        # Suffix 패턴: (for App), (Mobile)
        if match := re.search(r'\(([^)]+)\)$', item.name):
            modifiers["suffix"].append(match.group(1))

        # Category 패턴: GA4 - ETC - xxx, GA4 - BDP - xxx
        parts = item.name.split(" - ")
        if len(parts) >= 3:
            modifiers["category"].append(parts[1])

    return modifiers
```

---

## Variable Reference Pattern Detection

태그 파라미터에서 변수 참조 패턴을 추출합니다.

```python
def detect_variable_patterns(tags):
    """태그 파라미터에서 변수 참조 패턴 추출"""
    variable_refs = []

    for tag in tags:
        for param in tag.parameter:
            refs = re.findall(r'\{\{([^}]+)\}\}', param.value)
            variable_refs.extend(refs)

    patterns = {
        "ecommerce": [],  # "DL - Ecommerce Value" 형태
        "event": [],      # "DL - Event Action" 형태
        "simple": [],     # "DL - Value" 형태
        "config": []      # "GA4 - MeasurementID" 형태
    }

    for ref in variable_refs:
        if "Ecommerce" in ref:
            patterns["ecommerce"].append(ref)
        elif "Event" in ref:
            patterns["event"].append(ref)
        elif ref.startswith("DL - "):
            patterns["simple"].append(ref)
        elif ref.startswith("GA4 - ") or ref.startswith("GT - "):
            patterns["config"].append(ref)

    return patterns
```

---

## Pattern Output Example

```
Input:  ["GA4 - view_item", "GA4 - purchase", "GA4 - add_to_cart"]
Output:
  prefix = "GA4"
  separator = " - "
  case = snake_case
  confidence = 95%
```

---

## Event Inventory Structure

Full Analyze 시 생성되는 이벤트 인벤토리 구조입니다.

```python
inventory = {
    "events": {},           # 이벤트별 상세 정보
    "trigger_index": {},    # 트리거 이벤트명 → 트리거 ID
    "tag_index": {},        # GA4 이벤트명 → 태그 ID 리스트
    "issues": []            # 발견된 문제점
}
```

### Inventory Output Format

```
┌──────────────────────────────────────────────────────────────────┐
│ 📋 Event Inventory: [EC]BETC_Web                                 │
├──────────────────────────────────────────────────────────────────┤
│ 이벤트명              │ 태그                │ 트리거           │ 상태 │
├──────────────────────────────────────────────────────────────────┤
│ view_item_list       │ GA4 - View Item List │ CE - View Item.. │ ✅   │
│                      │ GA4 - View Item..(App)│                  │      │
│ view_item            │ GA4 - View Item      │ CE - View Item   │ ✅   │
│ add_to_cart          │ GA4 - Add To Cart    │ CE - Add To Cart │ ✅   │
│ purchase             │ GA4 - Purchase       │ CE - Purchase    │ ⚠️   │
│ select_item          │ (없음)               │ CE - Select Item │ ❌   │
├──────────────────────────────────────────────────────────────────┤
│ 총 이벤트: 25 | 정상: 22 | 경고: 2 | 오류: 1                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 관련 문서

- [naming-conventions.md](./naming-conventions.md) - GA4 네이밍 규칙, 케이스 변환
- [parameter-keys.md](./parameter-keys.md) - 파라미터 키 패턴 감지
- [external-identifiers.md](./external-identifiers.md) - 외부 식별자 prefix 감지
