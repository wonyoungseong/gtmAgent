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
| **태그 네이밍** | `GA4 - {category} - {action}` 패턴 (상세: naming-convention.md) |
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

## Resources

| 문서 | 내용 |
|------|------|
| [SKILL.md](.claude/skills/gtm/SKILL.md) | 워크플로우 |
| [naming-convention.md](.claude/skills/gtm/resources/references/naming-convention.md) | 네이밍 규칙 |
| [procedures.md](.claude/skills/gtm/resources/procedures.md) | 상세 절차 |
