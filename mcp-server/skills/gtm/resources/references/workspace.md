# Workspace Management Reference

## 원칙

```
⛔ Default 워크스페이스 직접 사용 금지
✅ 새 워크스페이스 생성 후 작업 진행
```

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
```

## 워크스페이스 제한

| 계정 유형 | 최대 워크스페이스 | 비고 |
|-----------|------------------|------|
| **무료** | 3개 | Default + 2개 추가 가능 |
| **유료 (360)** | 무제한 | 팀 협업용 |

## 작업 시작 워크플로우

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 1: 워크스페이스 현황 조회                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   gtm_workspace(action: "list", accountId, containerId)                 │
│                                                                         │
│   확인 항목:                                                             │
│   - 현재 워크스페이스 개수                                                │
│   - 기존 워크스페이스 목록 (name, description)                            │
│   - Default 워크스페이스 식별                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
          [3개 미만 (여유 있음)]              [3개 (제한 도달)]
                    │                               │
                    ▼                               ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────────┐
│ Step 2A: 새 워크스페이스 생성     │  │ Step 2B: 사용자 선택 요청             │
├─────────────────────────────────┤  ├─────────────────────────────────────┤
│                                 │  │                                     │
│ 자동 네이밍 적용                 │  │ 🚨 워크스페이스 제한 (3개) 도달       │
│                                 │  │                                     │
│                                 │  │ 현재 워크스페이스:                    │
│                                 │  │   1. Default (ID: 5)                │
│                                 │  │   2. Feature-ABC (ID: 32)           │
│                                 │  │   3. Hotfix-XYZ (ID: 45)            │
│                                 │  │                                     │
│                                 │  │ 선택:                                │
│                                 │  │   [A] 기존 워크스페이스 삭제          │
│                                 │  │   [B] 기존 워크스페이스에서 작업      │
│                                 │  │   [C] 기존 워크스페이스 수정 후 재사용 │
│                                 │  │                                     │
└─────────────────────────────────┘  └─────────────────────────────────────┘
```

## 자동 네이밍 규칙

### Case 1: 티켓 기반 작업 (JIRA, Asana 등)

```
이름: [티켓번호] 작업내용
설명: Ticket: {번호} | 작업: {내용} | 상세: {생성항목} | {날짜}

예시:
이름: "JIRA-456 start_camera"
설명: "Ticket: JIRA-456 | 작업: start_camera 이벤트 추가 |
       상세: CE trigger + GA4 tags (Web/App) | 2024-12-28"
```

### Case 2: 자체 수정 (티켓 없음)

```
이름: [작업유형] 이벤트명
설명: {작업내용} | GTM Agent | {목적} | {날짜}

예시:
이름: "Add start_camera"
설명: "start_camera 이벤트 추가 | GTM Agent |
       카메라 시작 추적 | 2024-12-28"
```

### 작업 유형 코드

| 코드 | 의미 |
|------|------|
| Add | 신규 추가 |
| Fix | 수정/버그픽스 |
| Update | 업데이트 |
| Remove | 삭제 |
| Refactor | 리팩토링 |

## 제한 도달 시 처리

```
옵션 A: 삭제 → GTM UI에서 직접 삭제 (MCP 사용 금지)
옵션 B: 기존 워크스페이스 사용 → MCP로 작업 진행
옵션 C: 기존 워크스페이스 수정 후 재사용 → MCP로 update 가능

⚠️ 워크스페이스 삭제는 반드시 GTM UI에서 수행하세요.
   https://tagmanager.google.com/ → 워크스페이스 탭 → 삭제
```

```python
def handle_workspace_limit(workspaces, requested_action):
    """워크스페이스 3개 제한 도달 시 처리"""

    # 옵션 A: 삭제 → GTM UI 안내
    if user_choice == "A":
        print("⚠️ 워크스페이스 삭제는 GTM UI에서 직접 수행해주세요.")
        print("   URL: https://tagmanager.google.com/")
        print("   삭제 후 다시 시도해주세요.")
        return None  # MCP로 삭제 수행 금지

    # 옵션 B: 기존 사용
    elif user_choice == "B":
        selected = ask_user("작업할 워크스페이스를 선택하세요", workspaces)
        return selected.workspaceId

    # 옵션 C: 수정 후 재사용
    elif user_choice == "C":
        selected = ask_user("수정할 워크스페이스를 선택하세요", workspaces)
        new_name = ask_user("새 이름을 입력하세요")
        new_desc = ask_user("새 설명을 입력하세요 (선택)")

        gtm_workspace(action="update", workspaceId=selected.id,
                      createOrUpdateConfig={"name": new_name, "description": new_desc})
        return selected.workspaceId
```

## 워크스페이스 상태 확인

```
작업 전 getStatus로 충돌 확인:

gtm_workspace(action: "getStatus", workspaceId)

→ 충돌 있음: sync 또는 resolveConflict 필요
→ 미게시 변경사항: 기존 작업 영향 확인
```
