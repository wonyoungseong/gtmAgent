# Tag Naming Convention

## Overview

GTM 태그 네이밍은 `event_category`와 `event_action` 값을 기반으로 작성합니다.

---

## Naming Pattern

### 패턴 구조

| 유형 | 패턴 | 예시 |
|------|------|------|
| **Basic Event** | `GA4 - Basic Event - {EventName}` | `GA4 - Basic Event - Page View` |
| **Ecommerce** | `GA4 - Ecommerce - {EventName}` | `GA4 - Ecommerce - View Item` |
| **비즈니스 이벤트** | `GA4 - {event_category} - {event_action}` | `GA4 - Start Diagnosis - Popup Impressions` |
| **Custom Event** | `GA4 - Custom Event - {category} - {action}` | `GA4 - Custom Event - BTS - Start Camera` |

### App 태그
- Web 태그명 뒤에 `(for App)` 추가
- 예: `GA4 - Start Diagnosis - Popup Impressions(for App)`

---

## Decision Logic

### event_category 결정 우선순위

```
1. event_category가 string 값으로 존재
   → 해당 값을 카테고리로 사용

2. event_category가 변수 ({{...}})로 선언
   → 사용자에게 실제 값 문의

3. event_category가 미설정
   → eventName이 GA4 Basic Event인지 확인

   3-1. Basic Event인 경우 (page_view, click, scroll 등)
        → "Basic Event" 사용

   3-2. Basic Event가 아닌 경우
        → 사용자에게 event_category 값 문의
```

### Flowchart

```
event_category 확인
       │
       ├─ string 값 존재 ──────────────────→ 해당 값 사용
       │
       ├─ 변수 ({{...}}) ──────────────────→ 사용자에게 문의
       │
       └─ 미설정 ─┬─ GA4 Basic Event ──────→ "Basic Event" 사용
                  │
                  └─ 그 외 ────────────────→ 사용자에게 문의
```

---

## GA4 Basic Events

다음 이벤트는 `GA4 - Basic Event - {Name}` 패턴 사용:

| 카테고리 | 이벤트 |
|----------|--------|
| **자동 수집** | page_view, first_visit, session_start, user_engagement |
| **향상된 측정** | scroll, click, file_download, video_start, video_progress, video_complete |
| **기본 상호작용** | view_search_results, search |

---

## Ecommerce Events

다음 이벤트는 `GA4 - Ecommerce - {Name}` 패턴 사용:

| 이벤트 | 태그명 |
|--------|--------|
| view_item_list | GA4 - Ecommerce - View Item List |
| select_item | GA4 - Ecommerce - Select Item |
| view_item | GA4 - Ecommerce - View Item |
| add_to_cart | GA4 - Ecommerce - Add To Cart |
| remove_from_cart | GA4 - Ecommerce - Remove From Cart |
| view_cart | GA4 - Ecommerce - View Cart |
| begin_checkout | GA4 - Ecommerce - Begin Checkout |
| add_shipping_info | GA4 - Ecommerce - Add Shipping Info |
| add_payment_info | GA4 - Ecommerce - Add Payment Info |
| purchase | GA4 - Ecommerce - Purchase |
| refund | GA4 - Ecommerce - Refund |
| view_promotion | GA4 - Ecommerce - View Promotion |
| select_promotion | GA4 - Ecommerce - Select Promotion |

---

## Case Rules

### 카테고리/액션 값 변환

- **원본 값**: snake_case (GA4 표준)
- **태그명 표기**: 첫글자 대문자, 나머지 소문자, 언더스코어 유지 또는 공백으로 변환

| 원본 값 | 태그명 표기 |
|---------|-------------|
| `start_diagnosis` | `Start Diagnosis` |
| `popup_impressions` | `Popup Impressions` |
| `ecommerce` | `Ecommerce` |
| `page_view` | `Page View` |

### 변환 규칙

```python
def format_tag_name_part(value):
    # snake_case → Title Case with spaces
    words = value.split('_')
    return ' '.join(word.capitalize() for word in words)

# 예시:
# start_diagnosis → Start Diagnosis
# popup_impressions → Popup Impressions
```

---

## Custom Event 특별 규칙

Custom Event (eventName = "custom_event")는 반드시 앞에 "Custom Event" 표기:

```
패턴: GA4 - Custom Event - {category} - {action}
예시: GA4 - Custom Event - BTS - Start Camera
```

### Custom Event 판별
- `eventName`이 `"custom_event"`인 경우
- 또는 event_category/action으로만 의미를 전달하는 범용 이벤트

---

## Examples

### 비즈니스 이벤트
```
dataLayer.push({
  'event': 'start_diagnosis',
  'event_category': 'start_diagnosis',
  'event_action': 'popup_impressions',
  'event_label': 'main'
});

→ 태그명: GA4 - Start Diagnosis - Popup Impressions
```

### Custom Event
```
dataLayer.push({
  'event': 'custom_event',
  'event_category': 'bts',
  'event_action': 'start_camera'
});

→ 태그명: GA4 - Custom Event - BTS - Start Camera
```

### Ecommerce
```
dataLayer.push({
  'event': 'view_item',
  'ecommerce': { ... }
});

→ 태그명: GA4 - Ecommerce - View Item
```

### Basic Event
```
GA4 enhanced measurement의 scroll 이벤트

→ 태그명: GA4 - Basic Event - Scroll
```

---

## Trigger Naming

트리거 네이밍은 별도 규칙:

| 타입 | 패턴 | 예시 |
|------|------|------|
| Custom Event | `CE - {Event Name}` | `CE - Start Diagnosis` |
| Page View | `PV - {Description}` | `PV - All Pages` |
| Click | `CL - {Description}` | `CL - CTA Button` |
| Timer | `TM - {Description}` | `TM - 10 Seconds` |
| Scroll | `SC - {Description}` | `SC - 50 Percent` |
| Element Visibility | `EV - {Description}` | `EV - Footer Visible` |

---

## Variable Naming

변수 네이밍 패턴:

| 타입 | 패턴 | 예시 |
|------|------|------|
| Data Layer | `DL - {Name}` | `DL - Event Action` |
| JavaScript | `JS - {Name}` | `JS - Page Type` |
| Constant | `CONST - {Name}` | `CONST - GA4 Measurement ID` |
| Lookup Table | `LT - {Name}` | `LT - Page Category` |
| RegEx Table | `RT - {Name}` | `RT - Campaign Source` |
| Cookie | `Cookie - {Name}` | `Cookie - User ID` |
| Custom JS | `CJS - {Name}` | `CJS - Get Timestamp` |
| Google Tag | `GT - {Name}` | `GT - Event Settings` |

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Tag Naming Decision                       │
├─────────────────────────────────────────────────────────────┤
│  1. event_category 확인                                      │
│     ├─ string → 해당 값 사용                                 │
│     ├─ 변수 → 사용자 문의                                    │
│     └─ 없음 → Basic Event 확인 후 결정                       │
│                                                              │
│  2. 이벤트 유형별 패턴                                        │
│     ├─ Basic Event  → GA4 - Basic Event - {Name}            │
│     ├─ Ecommerce    → GA4 - Ecommerce - {Name}              │
│     ├─ 비즈니스     → GA4 - {category} - {action}           │
│     └─ Custom Event → GA4 - Custom Event - {cat} - {act}    │
│                                                              │
│  3. App 태그: 뒤에 (for App) 추가                            │
└─────────────────────────────────────────────────────────────┘
```
