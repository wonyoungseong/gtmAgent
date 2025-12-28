# 3-Layer Duplicate Check Reference

## 개요

사전 인벤토리 없이 빠른 이벤트 존재 여부 확인을 위한 3-Layer 중복 체크 알고리즘.

## 왜 3-Layer가 필요한가?

```
예시: page_view 중복 케이스

담당자 A: "GA4 - Pageview" (Trigger: DOM Ready)
담당자 B: "GA4 - Page View" (Trigger: Consent Init)

→ Layer 1 (Trigger): ❌ customEvent 아님 → 감지 실패
→ Layer 2 (eventName): ✅ 둘 다 eventName="page_view" → 중복 감지!
→ Layer 3 (Tag Name): ✅ 유사도 높음 → 경고!
```

## 3-Layer 구조

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Trigger 기반 (customEvent만)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ → customEventFilter에서 이벤트명 검색                                    │
│ → add_to_cart, view_item 등 dataLayer.push 이벤트                       │
│ → 한계: DOM Ready, Init 등 다른 트리거 타입은 감지 못함                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Tag eventName 기반 ⭐                                          │
├─────────────────────────────────────────────────────────────────────────┤
│ → 모든 태그의 parameter[key="eventName"] 직접 검색                       │
│ → page_view, screen_view 등 트리거 타입 무관하게 감지                     │
│ → 트리거가 DOM Ready, Init, Consent Init 등이어도 발견 가능              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Tag Name 유사도 ⭐                                             │
├─────────────────────────────────────────────────────────────────────────┤
│ → "GA4 - Page View" vs "GA4 - Pageview" 감지                            │
│ → 정규화 비교 (공백, 대소문자, 특수문자 제거)                             │
│ → 오타나 네이밍 불일치로 인한 중복 방지                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Algorithm Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 이벤트 추가 요청: "page_view"                                │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Layer 1         │ │ Layer 2         │ │ Layer 3         │
│ Trigger 기반    │ │ Tag eventName   │ │ Tag Name 유사도 │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ Triggers 조회   │ │ Tags 조회       │ │ Tags 조회       │
│ (page 1-N)      │ │ (page 1-N)      │ │ (page 1-N)      │
│                 │ │                 │ │                 │
│ customEvent만   │ │ 모든 태그의     │ │ 태그명 정규화   │
│ 필터링          │ │ eventName 검색  │ │ 비교            │
└─────────────────┘ └─────────────────┘ └─────────────────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
              ┌────────────┴────────────┐
              │                         │
         [발견됨]                    [없음]
              │                         │
              ▼                         ▼
    중복 리스크 분석              신규 이벤트 생성
```

## Implementation

```python
def quick_lookup_event(event_name):
    """On-Demand 이벤트 조회 - 3-Layer 중복 체크"""

    result = {
        "event_name": event_name,
        "layer1_triggers": [],      # Trigger 기반 발견
        "layer2_tags": [],          # eventName 기반 발견
        "layer3_similar": [],       # 태그명 유사도 발견
        "api_calls": 0
    }

    # ═══════════════════════════════════════════════════════════
    # Layer 1: Trigger 기반 (customEvent만)
    # ═══════════════════════════════════════════════════════════
    page = 1
    all_triggers = []
    while True:
        triggers = gtm_trigger(action="list", page=page)
        result["api_calls"] += 1
        all_triggers.extend(triggers)
        if len(triggers) < 20:
            break
        page += 1

    for trigger in all_triggers:
        if trigger.type == "customEvent":
            trigger_event = extract_trigger_event(trigger.customEventFilter)
            if matches_event(trigger_event, event_name):
                result["layer1_triggers"].append({
                    "id": trigger.triggerId,
                    "name": trigger.name,
                    "event": trigger_event
                })

    # ═══════════════════════════════════════════════════════════
    # Layer 2 & 3: Tags 조회 (eventName + 태그명 유사도)
    # ═══════════════════════════════════════════════════════════
    page = 1
    all_tags = []
    while True:
        tags = gtm_tag(action="list", page=page)
        result["api_calls"] += 1
        all_tags.extend(tags)
        if len(tags) < 20:
            break
        page += 1

    trigger_ids = [t["id"] for t in result["layer1_triggers"]]

    for tag in all_tags:
        tag_event_name = extract_param(tag.parameter, "eventName")
        tag_info = build_tag_info(tag)

        # Layer 1 연결 태그 확인
        if trigger_ids and any(tid in (tag.firingTriggerId or []) for tid in trigger_ids):
            tag_info["detection"] = "layer1_connected"
            result["layer2_tags"].append(tag_info)
            continue

        # Layer 2: eventName 직접 매칭
        if tag_event_name and matches_event(tag_event_name, event_name):
            tag_info["detection"] = "layer2_eventName"
            result["layer2_tags"].append(tag_info)
            continue

        # Layer 3: 태그명 유사도 체크
        similarity = calculate_similarity(tag.name, event_name)
        if similarity >= 0.8:  # 80% 이상 유사
            tag_info["detection"] = "layer3_similar"
            tag_info["similarity"] = similarity
            result["layer3_similar"].append(tag_info)

    return result


def calculate_similarity(tag_name, event_name):
    """태그명과 이벤트명 유사도 계산 (정규화 비교)"""
    def normalize(s):
        return re.sub(r'[^a-z0-9]', '', s.lower())

    norm_tag = normalize(tag_name)
    norm_event = normalize(event_name)

    # 포함 관계 체크
    if norm_event in norm_tag:
        return 0.9

    # Levenshtein 거리 기반 유사도
    distance = levenshtein_distance(norm_tag, norm_event)
    max_len = max(len(norm_tag), len(norm_event))
    return 1 - (distance / max_len) if max_len > 0 else 0
```

## Use Cases

```
# Case 1: 신규 이벤트 (3-Layer 모두 미발견)
User: "custom_event_xyz 추가해줘"
→ Layer 1, 2, 3 모두 없음
→ "신규 이벤트입니다. 생성 진행합니다."

# Case 2: Layer 1 발견 (customEvent 트리거)
User: "view_item 추가해줘"
→ Layer 1: CE - View Item 발견!
→ 연결 태그: GA4 - View Item
→ 중복 리스크 보고

# Case 3: Layer 2 발견 (DOM Ready 트리거)
User: "page_view 추가해줘"
→ Layer 1: customEvent 아님 → 미발견
→ Layer 2: GA4 - Page View 발견! (Trigger: DOM Ready)
→ "기존 page_view 태그가 존재합니다"

# Case 4: Layer 3 발견 (태그명 유사도)
User: "pageview 추가해줘"
→ Layer 1, 2 미발견
→ Layer 3: "GA4 - Page View" ≈ "pageview" (유사도 92%)
→ "유사한 태그 'GA4 - Page View'가 있습니다. 같은 이벤트인가요?"
```

## API Call Comparison

| 시나리오 | Full Scan | 3-Layer Lookup | 절감 |
|---------|-----------|----------------|------|
| 신규 이벤트 | 8+ calls | 4-5 calls | 37-50% |
| Layer 1 발견 | 8+ calls | 4-5 calls | 37-50% |
| Layer 2 발견 | 8+ calls | 4-5 calls | 37-50% |
| Layer 3 발견 | 8+ calls | 4-5 calls | 37-50% |
