# GA4 Naming Conventions Reference

## GA4 Naming Convention (표준)

**GA4는 이벤트명과 파라미터 키에 snake_case를 권장합니다.**

### 이벤트명 규칙

```
✅ 권장 (snake_case)          ❌ 비권장
─────────────────────────────────────────
view_item                    viewItem
add_to_cart                  addToCart
begin_checkout               beginCheckout
complete_registration        completeRegistration
start_camera                 startCamera
```

### 파라미터 키 규칙

```
✅ 권장 (snake_case)          ❌ 비권장
─────────────────────────────────────────
item_id                      itemId
item_name                    itemName
page_type                    pageType
transaction_id               transactionId
payment_type                 paymentType
```

### GA4 표준 이벤트 (Ecommerce)

```
view_item_list    select_item       view_item
add_to_cart       remove_from_cart  view_cart
begin_checkout    add_shipping_info add_payment_info
purchase          refund
view_promotion    select_promotion
```

### GA4 표준 파라미터

```
Ecommerce:
  value, currency, items, coupon, tax, shipping
  transaction_id, affiliation, payment_type, shipping_tier
  item_list_name, item_list_id

User Engagement:
  search_term, method, content_type, item_id
```

---

## Case Conversion

### 케이스 타입

```python
def apply_case(text, target_case):
    if target_case == "snake_case":
        return "view_item"      # 소문자 + 언더스코어
    elif target_case == "Title Case":
        return "View Item"      # 각 단어 첫글자 대문자 + 공백
    elif target_case == "camelCase":
        return "viewItem"       # 첫 단어 소문자, 이후 대문자
    elif target_case == "PascalCase":
        return "ViewItem"       # 모든 단어 첫글자 대문자
```

### 변환 함수

```python
def to_snake_case(name):
    """camelCase/PascalCase → snake_case 변환"""
    import re
    # camelCase → snake_case
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

# 예시
to_snake_case("startCamera")      # → "start_camera"
to_snake_case("viewItemList")     # → "view_item_list"
to_snake_case("addPaymentInfo")   # → "add_payment_info"
```

### 케이스 감지

```python
def detect_case(text):
    if "_" in text and text == text.lower():
        return "snake_case"      # "view_item"
    elif " " in text and text == text.title():
        return "Title Case"      # "View Item"
    elif text[0].isupper() and "_" not in text:
        return "PascalCase"      # "ViewItem"
    elif text[0].islower() and any(c.isupper() for c in text[1:]):
        return "camelCase"       # "viewItem"
    else:
        return "lowercase"       # "purchase"
```

---

## GTM Tag Naming Convention

### Custom Event 태그 네이밍

```
패턴: GA4 - Custom Event - {Event Action in Title Case}

✅ 올바른 예시
─────────────────────────────────────────
GA4 - Custom Event - Imported Content Impression
GA4 - Custom Event - Video Play
GA4 - Custom Event - Button Click
GA4 - Custom Event - Form Submit

❌ 잘못된 예시
─────────────────────────────────────────
GA4 - ETC - Custom Event (Imported Content Impression)  ← ETC 사용 금지, 괄호 불필요
GA4 - Custom Event - imported_content_impression        ← snake_case 사용 금지
GA4 - Custom Event - IMPORTED CONTENT IMPRESSION        ← 대문자만 사용 금지
```

### 괄호 사용 규칙

```
괄호 = 플랫폼/환경 구분용으로만 사용

✅ 올바른 괄호 사용
─────────────────────────────────────────
GA4 - Custom Event - Video Play (for App)
GA4 - Custom Event - Button Click (for AOS)
GA4 - Custom Event - Form Submit (for iOS)

❌ 잘못된 괄호 사용
─────────────────────────────────────────
GA4 - Custom Event (Video Play)           ← 이벤트명에 괄호 사용 금지
GA4 - ETC - Custom Event (Video Play)     ← ETC 사용 금지
```

### 기타 GA4 태그 네이밍

```
Ecommerce 태그:
  GA4 - Ecommerce - View Item
  GA4 - Ecommerce - Add To Cart
  GA4 - Ecommerce - Purchase

Page View 태그:
  GA4 - Page View
  GA4 - Page View (for App)
```

### AD (광고) 태그 네이밍

```
패턴: AD - {Platform} - {Event in Title Case}

✅ 올바른 예시
─────────────────────────────────────────
AD - Library                              ← 라이브러리 로드용
AD - Meta - Page View
AD - Meta - Qualified Visit
AD - Meta - Add To Cart
AD - Meta - Purchase
AD - TikTok - Page View
AD - TikTok - Purchase
AD - Twitter - Page View

❌ 잘못된 예시
─────────────────────────────────────────
AD_comm_pageload                          ← 언더스코어 사용 금지
AD_comm_qualifiedVisit                    ← camelCase 혼합 금지
AD-Meta-PageView                          ← 공백 없이 대시만 사용 금지
```

**Platform 목록**:
- Meta (Facebook/Instagram)
- TikTok
- Twitter (X)
- Google Ads
- Kakao
- Naver

---

## 새 이벤트/파라미터 추가 시 체크리스트

```
GA4 이벤트/파라미터:
□ 이벤트명이 snake_case인가?
□ 파라미터 키가 snake_case인가?
□ 기존 컨테이너 패턴과 일치하는가?
□ camelCase 요청 시 snake_case로 변환했는가?
□ 사용자에게 변환 사실을 안내했는가?

GTM 태그 네이밍:
□ Custom Event 태그: "GA4 - Custom Event - {Title Case}" 패턴인가?
□ ETC 대신 Custom Event 사용했는가?
□ 괄호는 플랫폼 구분용으로만 사용했는가?
□ Event Action이 Title Case인가?

AD 태그 네이밍:
□ AD 태그: "AD - {Platform} - {Title Case}" 패턴인가?
□ 언더스코어(_) 대신 공백과 대시(-) 사용했는가?
□ Platform이 명확히 구분되어 있는가?
```

---

## 관련 문서

- [parameter-keys.md](./parameter-keys.md) - 파라미터 키 패턴 감지 및 정규화
- [pattern-detection.md](./pattern-detection.md) - 일반 패턴 감지 알고리즘
