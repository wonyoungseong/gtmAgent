# GTM Procedures

## References

| 문서 | 내용 |
|------|------|
| [naming-convention.md](./references/naming-convention.md) | 태그/트리거/변수 네이밍 |
| [event-types.md](./references/event-types.md) | Type A/B/C 분류 |
| [validation.md](./references/validation.md) | ES5, 검증 체크리스트 |
| [duplicate-check.md](./references/duplicate-check.md) | 3-Layer 중복 체크 |

---

## Phase 0: 환경 선택

### API 호출 (병렬)
```
gtm_account(action: "list")
gtm_container(action: "list", accountId)
gtm_workspace(action: "list", accountId, containerId)
```

### GTM 버전 판별
```
supportApprovals: true → 360 확정
Workspace >= 4 → 360 확정
Workspace <= 3 → 무료 추정
```

### AskUserQuestion 형식
```
questions: [
  { header: "Mode", options: [Single GTM, Multi GTM] },
  { header: "Account", options: [계정 + 버전] },
  { header: "Container", options: [컨테이너 + WS 개수] },
  { header: "Workspace", options: [워크스페이스] }
]
```

---

## Phase 1: 이벤트 정보

### 필수 수집
```
- event_name: 트리거 customEvent + 태그 eventName
- event_category: 태그명 첫 부분
- event_action: 태그명 두번째 부분
```

### 태그 네이밍 결정
```
1. event_category string → 해당 값 사용
2. event_category 변수 → 사용자 문의
3. 미설정 → Basic Event/Ecommerce 확인 → 없으면 문의
```

**상세**: [naming-convention.md](./references/naming-convention.md)

---

## Other Procedures

### Analyze
| 모드 | 용도 |
|------|------|
| Quick | 패턴 감지 (page 1만) |
| Full | 전체 분석 + 인벤토리 |

### Validate
```
Naming, References, Unused, Duplicates 검사
```

### Debug
```
이벤트명 → 트리거 → 태그 → 변수 추적
```

### Export
| 옵션 | 출력 |
|------|------|
| json | 구조화된 JSON |
| spec | DataLayer 스펙 |
| checklist | 개발팀용 체크리스트 |

---

## Helper

### URL 파싱
```
accounts/{accountId}/containers/{containerId}/workspaces/{workspaceId}
```

### 이벤트명 정규화
```python
name.lower().replace(" ", "_").replace("-", "_")
```
