# Event Type Classification (이벤트 유형 분류)

**⛔ 이벤트 추가 전 반드시 확인해야 할 핵심 질문**

```
"이 이벤트는 어디서 발생하는가?"
```

## 이벤트 발생 방식 분류

### Type A: 웹 발생 (Web-Originated)

```
웹 개발팀이 dataLayer.push({event: 'xxx'})로 발생시킴

예시:
- add_to_cart: 장바구니 버튼 클릭 시 웹에서 dataLayer.push
- purchase: 결제 완료 시 웹에서 dataLayer.push
- view_item: 상품 페이지 로드 시 웹에서 dataLayer.push

GTM 설정:
- Trigger: Custom Event (event = xxx)
- Tag: GA4 Event

✅ 단순 CE 트리거 생성으로 충분
```

### Type B: GTM 발생 (GTM-Originated)

```
GTM 내부에서 조건을 만들어 dataLayer.push 또는 직접 발동

예시:
- qualified_visit: 세션ID 확인 + 쿠키 체크 + 조건 충족 시 발동
- multi_host: 특정 링크 클릭 → HTML 태그에서 dataLayer.push
- page_view: DOM Ready 트리거로 직접 GA4 태그 발동

GTM 설정:
- 조건 트리거: DOM Ready, Timer, Element Visibility, Link Click 등
- 로직 태그: Custom HTML로 조건 체크 + dataLayer.push
- 플래그 관리: 쿠키로 중복 방지 (세션당 1회 등)
- 최종 태그: CE 트리거로 GA4 이벤트 전송

⚠️ 복잡한 로직 구현 필요 (단순 CE 트리거로 불가)
```

### Type C: 하이브리드 (Hybrid)

```
웹에서 이벤트 발생 + GTM에서 추가 조건/가공

예시:
- 웹에서 add_to_cart 발생 → GTM에서 쿠키 체크 후 조건부 전송
- 웹에서 page_view 발생 → GTM에서 특정 페이지만 필터링

GTM 설정:
- Trigger: Custom Event + Filter 조건 추가
- 또는 Setup/Teardown 태그로 전후 처리
```

## 이벤트 유형 확인 프로세스 (Add 전 필수)

```
Step 1: 사용자에게 이벤트 발생 방식 확인

질문: "{event_name} 이벤트는 어디서 발생하나요?"

[A] 웹에서 dataLayer.push로 발생 (개발팀 구현)
    → Type A: 단순 CE 트리거 생성

[B] GTM에서 조건을 만들어 발생시켜야 함
    → Type B: 조건/로직 설계 필요
    → 추가 질문 필요 (Step 2)

[C] 잘 모르겠음 / 확인 필요
    → 기존 유사 이벤트 패턴 분석으로 추정
```

## Type B 필요 시 사용자 확인 항목

```
이벤트: {event_name}
유형: Type B (GTM 발생)

확인 필요 사항:
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. 발동 조건                                                             │
│    □ 페이지 로드 시 (DOM Ready, Window Loaded)                          │
│    □ 특정 요소 클릭 시 (Click - Element/Link)                           │
│    □ 요소 가시성 (Element Visibility)                                   │
│    □ 스크롤 깊이 (Scroll Depth)                                         │
│    □ 타이머 (Timer)                                                     │
│    □ 폼 제출 (Form Submission)                                          │
│    □ 기타: _______________                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. 발동 조건 상세                                                        │
│    - 특정 페이지만? (Page Path 조건)                                    │
│    - 특정 요소? (CSS Selector, ID, Class)                               │
│    - 특정 시간? (초, 밀리초)                                             │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. 중복 방지 필요 여부                                                   │
│    □ 세션당 1회 (qualified_visit 패턴)                                  │
│    □ 페이지당 1회                                                        │
│    □ 사용자당 1회 (영구 쿠키)                                           │
│    □ 제한 없음 (매번 발동)                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. 필요한 데이터                                                         │
│    □ 세션 ID                                                             │
│    □ 클라이언트 ID                                                       │
│    □ 쿠키 값                                                             │
│    □ 페이지 정보                                                         │
│    □ 클릭 요소 정보                                                      │
│    □ 기타: _______________                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Self-Check: Add 작업 전

```
⛔ 다음을 확인하지 않고 CE 트리거를 생성하면 안 됨:

□ 이벤트 발생 방식 확인했나? (Type A / B / C)
□ Type B인 경우 조건/로직 설계했나?
□ 기존 유사 이벤트 패턴 분석했나?
□ 사용자에게 발생 방식 확인 질문했나?
```
