# GTM Procedures Reference

## MCP 안전 규칙 (필수)

```
🚫 MCP로 절대 수행하지 않는 작업:
─────────────────────────────────────────────
❌ 계정 삭제 (API 미지원)
❌ 컨테이너 삭제 (gtm_container action: remove)
❌ 워크스페이스 삭제 (gtm_workspace action: remove)
❌ 버전 배포 (gtm_version action: publish)

→ 위 작업은 GTM UI (tagmanager.google.com)에서 직접 수행
→ 되돌리기 어렵거나 프로덕션에 즉시 영향을 주는 작업임

✅ MCP 허용:
   - 분석/조회: list, get, getStatus
   - 생성: create (사용자 승인 후)
   - 수정: update (사용자 승인 후)
   - 버전 생성: createVersion (배포 전 검토용)
```

## Quick Reference

| 상세 문서 | 내용 |
|----------|------|
| [references/workspace.md](./references/workspace.md) | 워크스페이스 관리, 네이밍, 제한 처리 |
| [references/event-types.md](./references/event-types.md) | 이벤트 유형 분류 (Type A/B/C) |
| [references/duplicate-check.md](./references/duplicate-check.md) | 3-Layer 중복 체크 알고리즘 |
| [references/validation.md](./references/validation.md) | Pre-Add 검증, 중복 정의, ES5 표준 |
| [references/safety-rules-test.md](./references/safety-rules-test.md) | MCP 안전 규칙 TDD 명세 |
| [references/patterns.md](./references/patterns.md) | 패턴 문서 인덱스 |
| ├─ [naming-conventions.md](./references/naming-conventions.md) | GA4 네이밍, 케이스 변환 |
| ├─ [pattern-detection.md](./references/pattern-detection.md) | 패턴 감지 알고리즘, 인벤토리 |
| ├─ [parameter-keys.md](./references/parameter-keys.md) | 파라미터 키 패턴 |
| └─ [external-identifiers.md](./references/external-identifiers.md) | 외부 식별자 prefix |

---

## 1. Workspace Management (작업 전 필수)

**원칙**: Default 워크스페이스 직접 사용 금지 → 새 워크스페이스에서 작업

```
Step 1: gtm_workspace(action: "list") → 현황 확인
        ↓
Step 2: 3개 미만 → 새 워크스페이스 생성
        3개 도달 → 사용자에게 옵션 제시 (삭제/재사용/수정)
        ↓
Step 3: workspaceId 확보 후 작업 진행
```

**상세**: [references/workspace.md](./references/workspace.md)

---

## 2. Analyze Procedure

### 모드 선택

| 모드 | 용도 | API Calls |
|------|------|-----------|
| **Quick** | 패턴 감지 + 기본 검증 | 4-6 |
| **Full** | 전체 분석 + 인벤토리 | 8+ |

### Quick Analyze (기본)

```
1. gtm_account(action: list) → 계정 선택
2. gtm_container(action: list) → 컨테이너 선택
3. gtm_workspace(action: list) → 워크스페이스 선택
4. 샘플 조회 (page 1만):
   - gtm_tag(action: list, page: 1)
   - gtm_trigger(action: list, page: 1)
   - gtm_variable(action: list, page: 1)
5. 패턴 분석 → 사용자 확인
```

### Full Analyze (상세 분석)

```
1-3. (Quick과 동일)
4. 전체 데이터 페이지네이션 조회
5. 패턴 분석 (전체 데이터 기반)
6. 태그 파라미터 분석
7. 이벤트 인벤토리 생성
8. Configuration Audit
9. 리포트 출력
```

### 모드 선택 가이드

- "패턴만 확인" → Quick
- "전체 현황" → Full
- "이벤트 1개 추가" → Quick + On-Demand Lookup
- "이벤트 5개+ 추가" → Full (인벤토리 재사용)

---

## 3. Add Procedure

### 필수 전제 조건

```
⛔ CE 트리거 생성 전 반드시 확인:
□ 이벤트 유형 확인 (Type A/B/C)
□ Type B인 경우 조건/로직 설계
□ 기존 유사 이벤트 패턴 분석
```

**상세**: [references/event-types.md](./references/event-types.md)

### 이벤트 유형 빠른 판단

| Type | 발생 위치 | GTM 설정 |
|------|----------|---------|
| **A** | 웹 dataLayer.push | 단순 CE 트리거 |
| **B** | GTM 내부 로직 | 복잡한 조건/쿠키/로직 |
| **C** | 웹 + GTM 필터 | CE + 추가 조건 |

### Add 워크플로우

```
1. 이벤트 유형 확인 (필수!)
   └─ Type B라면: 발동 조건, 중복 방지, 필요 데이터 확인

2. 3-Layer 중복 체크
   └─ Layer 1: Trigger 기반 (customEvent)
   └─ Layer 2: Tag eventName 기반
   └─ Layer 3: Tag Name 유사도

3. 중복 발견 시:
   └─ 사용자에게 옵션 제시
   └─ a) 기존 설정 유지 (권장)
   └─ b) 기존 태그 수정
   └─ c) 다른 Property로 생성

4. 신규 생성:
   └─ 감지된 패턴 적용
   └─ 생성 순서: 변수 → 트리거 → 태그
```

**상세**:
- 중복 체크: [references/duplicate-check.md](./references/duplicate-check.md)
- 검증 로직: [references/validation.md](./references/validation.md)

---

## 4. Event Inventory

**Full Analyze 전용** - 다수 이벤트 추가 시 API 절감

```python
inventory = {
    "events": {},           # 이벤트별 상세 정보
    "trigger_index": {},    # 트리거 이벤트명 → 트리거 ID
    "tag_index": {},        # GA4 이벤트명 → 태그 ID 리스트
    "issues": []            # 발견된 문제점
}
```

**상세**: [references/pattern-detection.md](./references/pattern-detection.md)

---

## 5. Other Procedures

### Validate Procedure

```
전제: analyze 완료
1. Naming: 패턴 불일치
2. References: 없는 변수/트리거 참조
3. Unused: 미사용 항목
4. Duplicates: 중복 태그/트리거
```

### Debug Procedure

```
1. 이벤트명 → 트리거 찾기
2. 트리거 → 연결 태그 찾기
3. 태그 → 참조 변수 찾기
4. 존재 여부 확인
5. 체크리스트 생성
```

### Export Procedure

| 옵션 | 출력 |
|------|------|
| json | 구조화된 JSON |
| spec | DataLayer 스펙 문서 |
| checklist | 개발팀용 체크리스트 |

### Bulk Procedure

```
1. 모든 컨테이너 조회
2. 각 컨테이너별 패턴 분석
3. 컨테이너별 패턴 저장
4. 비교/동기화 리포트
```

---

## 6. Helper Functions

### 이벤트명 정규화

```python
def normalize_event_name(name):
    return name.lower().replace(" ", "_").replace("-", "_")
```

### 변수 참조 추출

```python
refs = re.findall(r'\{\{([^}]+)\}\}', param.value)
```

### 파라미터 추출

```python
def extract_param(parameters, key):
    for param in parameters:
        if param.key == key:
            return param.value
    return None
```

---

## 7. Ecommerce Reference

### 표준 이벤트
```
view_item_list, select_item, view_item, add_to_cart,
remove_from_cart, view_cart, begin_checkout,
add_shipping_info, add_payment_info, purchase, refund
```

### 필수 파라미터

| 이벤트 | 필수 |
|--------|------|
| view_item_list | items, item_list_name |
| view_item | items |
| add_to_cart | items, value, currency |
| purchase | items, value, currency, transaction_id |

**상세**: [references/validation.md](./references/validation.md)
