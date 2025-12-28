# External Identifier Prefix Reference

## 목적

GTM에서 관리하는 외부 충돌 가능 식별자들의 prefix 감지 및 적용

---

## 대상 범위

GTM에서 생성/관리하는 모든 외부 식별자:

| 유형 | 예시 | 충돌 위험 |
|------|------|----------|
| window 객체 속성 | `window.bdp_flag` | ⚠️ 높음 |
| Cookie 이름 | `bdp_sessionId` | ⚠️ 높음 |
| localStorage 키 | `bdp_userPrefs` | ⚠️ 높음 |
| sessionStorage 키 | `bdp_tempData` | ⚠️ 높음 |
| 전역 함수명 | `bdp_trackEvent()` | ⚠️ 높음 |
| Custom dataLayer 키 | `bdp_customData` | 중간 |
| Custom Event 이름 | `bdp_custom_event` | 낮음 |

---

## 왜 Prefix가 필요한가?

### 충돌 위험 시나리오

```
⚠️ 충돌 위험 시나리오
- 웹사이트 자체 JavaScript와 변수명 충돌
- 다른 GTM 컨테이너와 충돌 (동일 사이트에 여러 컨테이너)
- 서드파티 스크립트와 충돌 (광고, 분석 도구 등)
- 쿠키명 충돌로 인한 데이터 덮어쓰기
- localStorage 키 충돌로 인한 데이터 손실
```

### Prefix 사용 효과

```
✅ Prefix 사용 효과
- 프로젝트/팀 고유 네임스페이스 확보
- 변수 출처 즉시 식별 (디버깅 용이)
- 충돌 방지 및 유지보수성 향상
- GTM 관리 변수 일괄 검색/정리 가능
```

---

## Prefix 감지 알고리즘

```python
def detect_global_variable_prefix(variables, tags):
    """GTM에서 관리하는 모든 외부 식별자에서 prefix 패턴 감지"""

    prefixes = []

    for var in variables:
        # 1. 쿠키 변수에서 prefix 추출
        if var.type == "k":  # Cookie variable
            cookie_name = extract_param(var.parameter, "name")
            if "_" in cookie_name:
                prefix = cookie_name.split("_")[0] + "_"
                prefixes.append({"prefix": prefix, "type": "cookie", "name": cookie_name})

        # 2. Custom JavaScript 변수에서 패턴 추출
        if var.type == "jsm":
            js_code = extract_param(var.parameter, "javascript")
            extract_js_identifiers(js_code, prefixes)

    for tag in tags:
        # 3. Custom HTML 태그에서 패턴 추출
        if tag.type == "html":
            html_code = extract_param(tag.parameter, "html")
            extract_js_identifiers(html_code, prefixes)

    # 가장 많이 사용된 prefix 반환
    if prefixes:
        prefix_counts = Counter([p["prefix"] for p in prefixes])
        primary_prefix = prefix_counts.most_common(1)[0]
        return {
            "detected_prefix": primary_prefix[0],
            "count": primary_prefix[1],
            "all_prefixes": dict(prefix_counts),
            "confidence": primary_prefix[1] / len(prefixes),
            "details": prefixes
        }

    return None
```

### JavaScript 식별자 추출

```python
def extract_js_identifiers(code, prefixes):
    """JavaScript 코드에서 외부 식별자 추출"""

    # window 객체 속성
    window_vars = re.findall(r'window\.([a-zA-Z_][a-zA-Z0-9_]*)', code)
    for wv in window_vars:
        if "_" in wv:
            prefixes.append({"prefix": wv.split("_")[0] + "_", "type": "window", "name": wv})

    # localStorage
    ls_keys = re.findall(r'localStorage\.(get|set)Item\s*\(\s*[\'"]([^\'"]+)[\'"]', code)
    for _, key in ls_keys:
        if "_" in key:
            prefixes.append({"prefix": key.split("_")[0] + "_", "type": "localStorage", "name": key})

    # sessionStorage
    ss_keys = re.findall(r'sessionStorage\.(get|set)Item\s*\(\s*[\'"]([^\'"]+)[\'"]', code)
    for _, key in ss_keys:
        if "_" in key:
            prefixes.append({"prefix": key.split("_")[0] + "_", "type": "sessionStorage", "name": key})

    # document.cookie 직접 설정
    cookie_sets = re.findall(r'document\.cookie\s*=\s*[\'"]([^=]+)=', code)
    for cookie_name in cookie_sets:
        if "_" in cookie_name:
            prefixes.append({"prefix": cookie_name.split("_")[0] + "_", "type": "cookie", "name": cookie_name})

    # 전역 함수 선언 (function xxx() 또는 var xxx = function)
    global_funcs = re.findall(r'(?:function\s+|var\s+)([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=\s*function)?\s*\(', code)
    for func in global_funcs:
        if "_" in func:
            prefixes.append({"prefix": func.split("_")[0] + "_", "type": "function", "name": func})
```

---

## 사용자 확인 워크플로우

### Prefix 감지됨

```
외부 식별자 생성 필요 시:

1. 기존 Prefix 패턴 감지
   └─ 쿠키 변수명: bdp_multiHost_eventFired, bdp_gaSID
   └─ window 속성: window.bdp_flag
   └─ localStorage: bdp_userPrefs
   └─ 전역 함수: bdp_trackEvent()
   └─ 감지 결과: "bdp_" (신뢰도 95%)

2. 사용자에게 확인
   ┌─────────────────────────────────────────────────────┐
   │ 🔍 GTM 외부 식별자 Prefix 확인                       │
   ├─────────────────────────────────────────────────────┤
   │ 감지된 기존 패턴: bdp_ (5개 식별자에서 사용 중)       │
   │                                                     │
   │ 발견된 유형:                                         │
   │ - Cookie: 3개 (bdp_gaSID, bdp_eventFired...)        │
   │ - window: 1개 (bdp_flag)                            │
   │ - localStorage: 1개 (bdp_userPrefs)                 │
   │                                                     │
   │ 생성할 식별자: window.bdp_contentLoaded              │
   │                                                     │
   │ 이 prefix를 사용할까요?                              │
   │ a) bdp_ 사용 (권장 - 기존 패턴 유지)                 │
   │ b) 다른 prefix 지정                                  │
   │ c) prefix 없이 생성 (비권장 ⚠️)                      │
   └─────────────────────────────────────────────────────┘

3. 사용자 선택에 따라 진행
   └─ a) 선택 시: window.bdp_contentLoaded
   └─ b) 선택 시: 새 prefix 입력 받아 적용
   └─ c) 선택 시: 충돌 위험 경고 후 생성
```

### Prefix 미감지

```
기존 Prefix 미감지 시:

1. 사용자에게 prefix 지정 요청
   ┌─────────────────────────────────────────────────────┐
   │ ⚠️ GTM 외부 식별자 Prefix 미감지                     │
   ├─────────────────────────────────────────────────────┤
   │ 기존 컨테이너에서 외부 식별자 prefix 패턴을           │
   │ 발견하지 못했습니다.                                 │
   │                                                     │
   │ 웹사이트/서드파티와의 충돌 방지를 위해               │
   │ prefix를 지정해주세요:                               │
   │                                                     │
   │ 예시:                                               │
   │ - 팀명: bdp_, mkt_, dev_                            │
   │ - 프로젝트: betc_, shop_, app_                      │
   │ - 회사: acme_, abc_                                 │
   │                                                     │
   │ Prefix 입력: ________________                        │
   └─────────────────────────────────────────────────────┘

2. 입력된 prefix로 모든 외부 식별자에 적용
   └─ 입력: "bdp_"
   └─ window 속성: window.bdp_contentLoaded
   └─ Cookie: bdp_sessionFlag
   └─ localStorage: bdp_userData
```

---

## 체크리스트

```
외부 식별자 (Cookie, window, localStorage 등) 생성 전:
□ 기존 컨테이너에서 prefix 패턴 감지했나?
□ 쿠키, window, localStorage, 함수 등 모든 유형 검토했나?
□ 감지된 prefix가 있으면 사용자에게 확인했나?
□ 감지된 prefix가 없으면 새 prefix 요청했나?
□ 사용자 승인 후 생성했나?
□ 관련된 모든 코드(JS 변수, HTML 태그)에 동일 prefix 적용했나?
```

---

## 분석 출력 예시

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 GTM External Identifier Prefix Analysis               │
├─────────────────────────────────────────────────────────┤
│ Detected Prefix: bdp_                                    │
│ Confidence: 95% (5/5 identifiers)                        │
│                                                          │
│ Found by Type:                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Type          │ Count │ Examples                    │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Cookie        │ 3     │ bdp_gaSID, bdp_eventFired   │ │
│ │ window        │ 1     │ bdp_flag                    │ │
│ │ localStorage  │ 1     │ bdp_userPrefs               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Recommendation: Use "bdp_" prefix for new identifiers    │
└─────────────────────────────────────────────────────────┘
```

---

## 관련 문서

- [naming-conventions.md](./naming-conventions.md) - GA4 네이밍 규칙
- [validation.md](./validation.md) - Pre-Add 검증
