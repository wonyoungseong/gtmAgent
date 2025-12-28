# Pattern Reference Index

GTM 패턴 관련 문서 인덱스입니다.

## 문서 구조

| 문서 | 내용 | 주요 용도 |
|------|------|----------|
| [naming-conventions.md](./naming-conventions.md) | GA4 네이밍 규칙, 케이스 변환 | 이벤트/파라미터 네이밍 |
| [pattern-detection.md](./pattern-detection.md) | 패턴 감지 알고리즘, 인벤토리 | 컨테이너 분석 |
| [parameter-keys.md](./parameter-keys.md) | 파라미터 키 패턴 감지 | 파라미터 추가 시 검증 |
| [external-identifiers.md](./external-identifiers.md) | 외부 식별자 prefix 감지 | Cookie/window 등 생성 시 |

---

## Quick Reference

### GA4 Naming (snake_case)

```
❌ camelCase          ✅ snake_case
─────────────────────────────────
viewItem          →  view_item
pageType          →  page_type
```

→ 상세: [naming-conventions.md](./naming-conventions.md)

### Pattern Detection

```
Input:  ["GA4 - view_item", "GA4 - purchase"]
Output:
  prefix = "GA4"
  separator = " - "
  case = snake_case
```

→ 상세: [pattern-detection.md](./pattern-detection.md)

### Parameter Key Pattern

```
page_type ≡ pageType ≡ PageType
→ 정규화 시 동일한 파라미터로 취급
```

→ 상세: [parameter-keys.md](./parameter-keys.md)

### External Identifier Prefix

```
❌ 잘못된 예              ✅ 올바른 예
─────────────────────────────────────
window._flag         →  window.bdp_flag
_sessionCookie       →  bdp_sessionCookie
localStorage.temp    →  localStorage.bdp_temp
```

→ 상세: [external-identifiers.md](./external-identifiers.md)

---

## 관련 문서

- [validation.md](./validation.md) - Pre-Add 검증, ES5 코드 표준
- [duplicate-check.md](./duplicate-check.md) - 3-Layer 중복 체크
- [event-types.md](./event-types.md) - 이벤트 유형 분류
