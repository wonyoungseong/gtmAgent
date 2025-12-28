---
name: gtm
description: GTM 컨테이너 관리. 분석, 이벤트 추가, 검증, 디버깅, 내보내기, 다중 컨테이너 작업.
user-invokable: true
---

# GTM Agent

**GTM이 유일한 진실의 원천입니다.**

---

## Golden Rules

```
0. ENVIRONMENT FIRST - 환경 선택 최우선 (Mode → Account → Container → Workspace)
1. PARSE FIRST - 항상 GTM 분석 먼저
2. PATTERNS FROM GTM - GTM에서 패턴 추출
3. ASK EVENT INFO - event_name, event_category, event_action 수집
4. NAMING BY CATEGORY - event_category 기반 태그 네이밍
5. 3-LAYER CHECK - 중복 체크 필수
6. ES5 ONLY - ES5 코드만
7. CONFIRM WITH USER - 사용자 승인 후 생성
```

---

## Critical Rules

| 규칙 | 설명 |
|------|------|
| **환경 선택** | AskUserQuestion으로 Mode/Account/Container/Workspace 한 번에 선택 |
| **이벤트 정보** | event_name, event_category, event_action 필수 수집 |
| **태그 네이밍** | `GA4 - {category} - {action}` 패턴 (상세: [naming-convention.md](resources/references/naming-convention.md)) |
| **ES5 필수** | `var`, `function(){}`, `&&` 체이닝만 사용 |
| **MCP 금지** | `remove(workspace/container)`, `publish` 절대 호출 금지 |

---

## Tag Naming Quick Reference

| 유형 | 패턴 |
|------|------|
| Basic Event | `GA4 - Basic Event - {Name}` |
| Ecommerce | `GA4 - Ecommerce - {Name}` |
| 비즈니스 | `GA4 - {category} - {action}` |
| Custom Event | `GA4 - Custom Event - {category} - {action}` |

---

## Add Event Workflow

```
Phase 0: 환경 선택 → Phase 1: 이벤트 정보 → Phase 2: 트리거 → Phase 3: 설정 → Phase 4: 생성
```

### Phase 0: 환경 선택

**1. 병렬로 데이터 수집**
```
gtm_account(action: "list")
gtm_container(action: "list", accountId) × N개
gtm_workspace(action: "list", ...) × N개
```

**2. AskUserQuestion 한 번에 4개 탭**
```
[Mode] Edit/Read
[Account] BETC | serverSideTest | ...
[Container] [EC]BETC_Web | [EC]BETC_VUE_WEB | ...
[Workspace] Default Workspace | 새 워크스페이스 생성
```

> ⚠️ 한 번에 모든 환경을 선택받아야 함 (순차 질문 금지)

### Phase 1: 이벤트 정보 수집
```
필수 수집:
- event_name → 트리거 + eventName
- event_category → 태그명 첫 부분
- event_action → 태그명 두번째 부분
```

### Phase 2: 트리거
```
기존 트리거 사용 or 새 트리거 생성 (Type A/B/C)
```

### Phase 3: 데이터 설정
```
Measurement ID, Parameters (key/value)
```

### Phase 4: 생성
```
3-Layer 중복 체크 → 사용자 승인 → 생성 (변수 → 트리거 → 태그)
```

---

## MCP Safety

```
⛔ 금지: remove(workspace/container), publish
✅ 허용: list, get, create, update (승인 후)
```

---

## References

| 문서 | 내용 |
|------|------|
| [procedures.md](resources/procedures.md) | 상세 절차 |
| [naming-convention.md](resources/references/naming-convention.md) | 태그 네이밍 |
| [event-types.md](resources/references/event-types.md) | Type A/B/C |
| [validation.md](resources/references/validation.md) | ES5, 검증 |
