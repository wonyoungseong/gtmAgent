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

> ⚠️ **핵심 원칙**: 모든 환경 선택을 **한 번의 AskUserQuestion**으로 처리

### Step 1: 병렬 데이터 수집

```javascript
// 1. 계정 목록 조회
gtm_account(action: "list")

// 2. 각 계정별 컨테이너 조회 (병렬)
gtm_container(action: "list", accountId: "6262702160")
gtm_container(action: "list", accountId: "6293242161")

// 3. 주요 컨테이너별 워크스페이스 조회 (병렬)
gtm_workspace(action: "list", accountId, containerId)
```

### Step 2: AskUserQuestion 한 번에 4개 질문

```javascript
AskUserQuestion({
  questions: [
    {
      header: "Mode",
      question: "작업 모드를 선택해주세요",
      options: [
        { label: "Edit (Recommended)", description: "태그/트리거/변수 생성 및 수정" },
        { label: "Read", description: "조회만 (변경 없음)" }
      ]
    },
    {
      header: "Account",
      question: "GTM 계정을 선택해주세요",
      options: [
        { label: "BETC", description: "ID: 6262702160 | 컨테이너 3개" },
        { label: "serverSideTest", description: "ID: 6293242161 | 서버사이드" }
      ]
    },
    {
      header: "Container",
      question: "컨테이너를 선택해주세요",
      options: [
        { label: "[EC]BETC_Web", description: "BETC | Web | GTM-56QPGJLB" },
        { label: "[EC]BETC_VUE_WEB", description: "BETC | Web | GTM-W6W7LFTW" },
        { label: "sgtm-betc.co.kr", description: "BETC | Server | GTM-5SM6WKJW" }
      ]
    },
    {
      header: "Workspace",
      question: "워크스페이스를 선택해주세요",
      options: [
        { label: "Default Workspace", description: "기본 워크스페이스" },
        { label: "새 워크스페이스 생성", description: "새로운 워크스페이스를 만듭니다" }
      ]
    }
  ]
})
```

### GTM 버전 판별
```
supportApprovals: true → 360 확정
Workspace >= 4 → 360 확정
Workspace <= 3 → 무료 추정
```

### ❌ 잘못된 예시 (순차 질문)
```
1번째 질문: Account?  ← 비효율
2번째 질문: Container?
3번째 질문: Workspace?
```

### ✅ 올바른 예시 (한 번에)
```
AskUserQuestion 4개 탭:
[Mode] [Account] [Container] [Workspace]
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
