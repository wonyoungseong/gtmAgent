# Parameter Key Pattern Reference

## 목적

태그 파라미터 키의 네이밍 컨벤션 감지 및 정규화

---

## 케이스 동등성

```
page_type ≡ pageType ≡ PageType ≡ PAGE_TYPE
→ 정규화 시 동일한 파라미터로 취급
```

---

## 패턴 감지 알고리즘

```python
def detect_parameter_key_pattern(tags):
    """태그 파라미터 키에서 네이밍 패턴 감지"""

    param_keys = []
    for tag in tags:
        if tag.type == "gaawc":  # GA4 Event tag
            event_params = extract_event_parameters(tag.parameter)
            param_keys.extend([p.key for p in event_params])

    # 케이스별 분류
    case_counts = {
        "snake_case": 0,   # page_type, item_id
        "camelCase": 0,    # pageType, itemId
        "lowercase": 0,    # pagetype, itemid
        "mixed": 0         # 혼합 사용
    }

    for key in param_keys:
        case_counts[detect_case(key)] += 1

    primary_case = max(case_counts, key=case_counts.get)
    consistency = case_counts[primary_case] / len(param_keys)

    return {
        "primary_case": primary_case,
        "consistency": consistency,
        "total_keys": len(param_keys),
        "breakdown": case_counts
    }

def detect_case(key):
    """개별 키의 케이스 감지"""
    if "_" in key and key.islower():
        return "snake_case"
    elif key[0].islower() and any(c.isupper() for c in key[1:]):
        return "camelCase"
    elif key.islower():
        return "lowercase"
    else:
        return "mixed"
```

---

## 정규화 함수

```python
def normalize_key(key, target_case="snake_case"):
    """파라미터 키를 기준 케이스로 정규화"""

    # 1. 단어 분리 (camelCase, snake_case 모두 처리)
    words = re.sub(r'([a-z])([A-Z])', r'\1_\2', key).lower().split('_')

    # 2. 타겟 케이스로 변환
    if target_case == "snake_case":
        return "_".join(words)
    elif target_case == "camelCase":
        return words[0] + "".join(w.capitalize() for w in words[1:])

    return key

# 예시
normalize_key("pageType", "snake_case")  # → "page_type"
normalize_key("page_type", "camelCase")  # → "pageType"
normalize_key("PAGE_TYPE", "snake_case") # → "page_type"
```

---

## 중복 파라미터 감지

동일 의미의 파라미터가 다른 케이스로 존재하는지 감지합니다.

```python
def find_duplicate_parameters(tags):
    """동일 의미의 파라미터가 다른 케이스로 존재하는지 감지"""

    all_keys = []
    for tag in tags:
        params = extract_event_parameters(tag.parameter)
        for p in params:
            all_keys.append({
                "original": p.key,
                "normalized": normalize_key(p.key),
                "tag_name": tag.name,
                "tag_id": tag.tagId
            })

    # 정규화된 키 기준 그룹핑
    grouped = {}
    for item in all_keys:
        norm = item["normalized"]
        if norm not in grouped:
            grouped[norm] = []
        grouped[norm].append(item)

    # 중복 (같은 정규화 키, 다른 원본 케이스)
    duplicates = []
    for norm_key, items in grouped.items():
        originals = set(i["original"] for i in items)
        if len(originals) > 1:
            duplicates.append({
                "normalized": norm_key,
                "variants": list(originals),
                "occurrences": items
            })

    return duplicates
```

---

## 사용자 피드백 워크플로우

```
사용자 요청: "pageType 파라미터 추가해줘"

1. 기존 패턴 감지
   → 컨테이너 분석 결과: snake_case 95% 사용 중

2. 불일치 감지
   → 요청: "pageType" (camelCase)
   → 기존: "page_type" (snake_case)

3. 사용자에게 피드백
   ┌─────────────────────────────────────────────────────┐
   │ ⚠️ 파라미터 네이밍 불일치 감지                       │
   ├─────────────────────────────────────────────────────┤
   │ 요청: pageType (camelCase)                          │
   │ 기존 패턴: snake_case (95% 일관성)                   │
   │                                                     │
   │ 기존 유사 파라미터:                                  │
   │ - page_type (GA4 - View Item 태그에서 사용 중)      │
   │                                                     │
   │ 선택:                                               │
   │ a) page_type으로 변환 (권장 - 기존 패턴 유지)        │
   │ b) pageType 그대로 사용 (불일치 허용)                │
   │ c) 기존 page_type 재사용                            │
   └─────────────────────────────────────────────────────┘

4. 사용자 선택에 따라 진행
```

---

## 분석 출력 예시

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Parameter Key Analysis                               │
├─────────────────────────────────────────────────────────┤
│ Primary Case: snake_case (95%)                          │
│ Total Keys: 42                                          │
│                                                         │
│ Case Breakdown:                                         │
│ - snake_case: 40 (page_type, item_id, item_name...)    │
│ - camelCase:  2  (pageType, itemId) ⚠️                  │
│                                                         │
│ Inconsistencies Found:                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ page_type ↔ pageType                                │ │
│ │ - "page_type" in: GA4 - View Item, GA4 - Purchase   │ │
│ │ - "pageType" in: GA4 - Add To Cart                  │ │
│ │ → 권장: page_type으로 통일                          │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 관련 문서

- [naming-conventions.md](./naming-conventions.md) - GA4 네이밍 규칙
- [pattern-detection.md](./pattern-detection.md) - 일반 패턴 감지 알고리즘
