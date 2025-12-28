---
name: gtm
description: GTM 컨테이너 관리. 분석, 이벤트 추가, 검증, 디버깅, 내보내기, 다중 컨테이너 작업.
---

# GTM Agent Workflow

## Add Event Flow

```
Phase 0: 환경 선택 → Phase 1: 이벤트 정보 → Phase 2: 트리거 → Phase 3: 설정 → Phase 4: 생성
```

### Phase 0: 환경 선택
```
AskUserQuestion 한 번에:
- Mode: Single/Multi GTM
- Account: 계정 선택
- Container: 컨테이너 선택
- Workspace: 워크스페이스 선택
```

### Phase 1: 이벤트 정보 수집
```
필수 수집:
- event_name → 트리거 + eventName
- event_category → 태그명 첫 부분
- event_action → 태그명 두번째 부분

태그 네이밍: [naming-convention.md](resources/references/naming-convention.md)
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
