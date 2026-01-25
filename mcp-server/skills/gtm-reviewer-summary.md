# GTM 검토자용 요약 템플릿 (Jira 배포 요청용)

GTM 작업 완료 후 **Jira 티켓에 운영 배포 요청**을 위한 요약문을 작성하는 템플릿입니다.

## 용도 구분 (중요!)

| 용도 | 템플릿 | 키워드 |
|------|--------|--------|
| **Jira 배포 요청** | 이 템플릿 | "Jira", "배포 요청", "운영 배포", "검토자", "확인자", "description" |
| **GTM Workspace 설명** | `workspace.md` | "workspace description", "버전 설명", "GTM 내부" |

### Agent 판단 규칙

```
사용자 요청 분석:
├─ "Jira", "배포 요청", "운영 배포", "검토자용" 포함
│   └─ → 이 템플릿 사용 (Jira 배포 요청용)
├─ "workspace description", "버전 설명" 포함
│   └─ → workspace.md 참조 (GTM 내부용)
└─ 불명확한 경우
    └─ → 사용자에게 질문:
         "어떤 용도의 요약을 원하시나요?
          [A] Jira 운영 배포 요청용 (검토자 전달)
          [B] GTM Workspace Description (버전 관리용)"
```

## 템플릿 형식

```
GTM Container: [컨테이너 타입] 컨테이너 이름

Work Space Name: 워크스페이스 이름

Work Space URL: 워크스페이스 URL

[변경 유형]:
- 변경 항목 1
- 변경 항목 2
- 변경 항목 3 (상세 설명이 필요한 경우 추가)
```

## 필수 항목

| 항목 | 설명 | 예시 |
|------|------|------|
| GTM Container | 컨테이너 타입과 이름 | `[EC] INNISFREE - KR` |
| Work Space Name | 작업 워크스페이스 이름 | `qualifiedVisitScrollDepth50` |
| Work Space URL | GTM 워크스페이스 직접 링크 | `https://tagmanager.google.com/#/container/accounts/...` |
| 변경 유형 | 작업 성격에 따른 섹션 제목 | 적용 사항, 코드 적용, 수정 내용 등 |

## 변경 유형별 섹션 제목

작업 성격에 따라 적절한 섹션 제목을 선택합니다:

| 작업 유형 | 섹션 제목 | 사용 시점 |
|----------|----------|----------|
| 신규 구현 | **적용 사항** | 새로운 태그/트리거/변수 추가 |
| 코드 작성 | **코드 적용** | Custom HTML, 스크립트 구현 |
| 수정 작업 | **수정 내용** | 기존 설정 변경, 값 수정 |
| 삭제 작업 | **삭제 항목** | 태그/트리거/변수 제거 |
| 복합 작업 | **작업 내용** | 여러 유형이 혼합된 경우 |

## 작성 가이드라인

### 1. 변경 항목 작성 규칙

**간단한 변경:**
```
- 커스텀 픽셀 방지 (page_load_time)
- Measurement ID 변경: Test Property (G-FSH6PFZKBT) -> INNISFREE - JP (G-H1KEQEVLT2)
```

**태그/트리거/변수 수정:**
```
- CE - Ap Scroll 50% (트리거 이벤트명 변경)
- HTML - Push Qualified Visit Event - Scroll 50% (이벤트 라벨 값 변경: 90% -> 50%)
- HTML - SPA Scroll Listener (50% Push & Reset) (이벤트 발생 조건 변경)
```

**복잡한 로직 설명:**
```
- SPA 페이지 뷰 추가
- Custom Event 코드 추가
- SPA 용 Element Visibility Trigger 추가
  SPA 환경의 Element Visibility 제한으로, 페이지 전환(History Change) 시 플래그를 'N'으로 리셋하는 코드를 구현했습니다.
  이에 플래그가 없거나 'N'인 상태에서만 노출 이벤트를 발생시켜 정확한 데이터 수집이 가능합니다.
```

### 2. 명명 규칙

- **태그 이름**: 정확한 GTM 태그 이름 사용 (예: `HTML - Push Qualified Visit Event`)
- **변경 내용**: 괄호 안에 변경 사항 명시 (예: `(이벤트 라벨 값 변경: 90% -> 50%)`)
- **ID 변경**: 이전 값 -> 새 값 형식 사용

### 3. URL 형식

워크스페이스 URL은 다음 형식을 따릅니다:
```
https://tagmanager.google.com/#/container/accounts/{accountId}/containers/{containerId}/workspaces/{workspaceId}?orgId={orgId}
```

## 예시

### 예시 1: 신규 적용

```
GTM Container: [EC] INNISFREE - JP

Work Space Name: Shopify Tag Manager

Work Space URL: https://tagmanager.google.com/#/container/accounts/6207024013/containers/172991965/workspaces/19?orgId=uEgL148oRg-XsJhptxw9bw

적용 사항:
- 커스텀 픽셀 방지 (page_load_time)
- Measurement ID 변경: Test Property (G-FSH6PFZKBT) -> INNISFREE - JP (G-H1KEQEVLT2)
```

### 예시 2: 코드 구현

```
GTM Container: [OTHERS] 아모레퍼시픽 공식 대시보드

Work Space Name: ITO0411-772_(구축) 리포트서비스리뉴얼 GA 지원 요청

Work Space URL: https://tagmanager.google.com/#/container/accounts/6207024013/containers/172988365/workspaces/11?orgId=uEgL148oRg-XsJhptxw9bw

코드 적용:
- SPA 페이지 뷰 추가
- Custom Event 코드 추가
- SPA 용 Element Visibility Trigger 추가
  SPA 환경의 Element Visibility 제한으로, 페이지 전환(History Change) 시 플래그를 'N'으로 리셋하는 코드를 구현했습니다.
  이에 플래그가 없거나 'N'인 상태에서만 노출 이벤트를 발생시켜 정확한 데이터 수집이 가능합니다.
```

### 예시 3: 설정 수정

```
GTM Container: [EC] INNISFREE - KR

Work Space Name: qualifiedVisitScrollDepth50

Work Space URL: https://tagmanager.google.com/#/container/accounts/6207024013/containers/172990758/workspaces/81?orgId=uEgL148oRg-XsJhptxw9bw

수정 내용:
- CE - Ap Scroll 50% (트리거 이벤트명 변경)
- HTML - Push Qualified Visit Event - Scroll 50% (이벤트 라벨 값 변경: 90% -> 50%)
- HTML - SPA Scroll Listener (50% Push & Reset) (이벤트 발생 조건 변경)
```

## Workspace Description과의 차이점

| 구분 | Workspace Description | GTM 검토자 요약 |
|------|----------------------|----------------|
| 용도 | GTM 내부 버전 관리용 | 검토자/확인자 전달용 |
| 형식 | 간결한 1-2줄 설명 | 상세한 변경 목록 |
| 포함 정보 | 작업 목적 | Container, URL, 변경 상세 |
| 작성 시점 | 워크스페이스 생성/수정 시 | 작업 완료 후 검토 요청 시 |

## 자동 생성 정보

MCP 도구를 통해 다음 정보를 자동으로 가져올 수 있습니다:

- **GTM Container**: `gtm_container` action='get'으로 조회
- **Work Space Name**: `gtm_workspace` action='get'으로 조회
- **Work Space URL**: accountId, containerId, workspaceId 조합으로 생성
- **변경 내용**: `gtm_workspace` action='getStatus'로 변경된 항목 조회

## Agent 호출 가이드

### 1. Jira 배포 요청용 요약 생성

사용자가 다음과 같이 요청할 때 이 템플릿을 사용:

```
"Jira 티켓에 올릴 배포 요청 description 작성해줘"
"운영 배포 요청용 요약 만들어줘"
"검토자한테 보낼 작업 내용 정리해줘"
"배포 확인자용 요약 작성해줘"
```

### 2. GTM Workspace Description 요청

사용자가 다음과 같이 요청할 때 `workspace.md` 템플릿 사용:

```
"workspace description 업데이트해줘"
"버전 설명 작성해줘"
"GTM 내부 설명 업데이트"
```

### 3. 불명확한 요청 처리

사용자 요청이 불명확할 때 **반드시** 질문:

```javascript
AskUserQuestion({
  question: "어떤 용도의 요약을 원하시나요?",
  header: "요약 용도",
  options: [
    {
      label: "Jira 배포 요청용",
      description: "검토자/확인자에게 전달할 운영 배포 요청 요약"
    },
    {
      label: "GTM Workspace Description",
      description: "GTM 내부 버전 관리용 간결한 설명"
    }
  ]
})
```

## 생성 워크플로우

```
1. 현재 컨텍스트 확인
   gtm_context({ action: "get" })

2. Container 정보 조회
   gtm_container({ action: "get", containerId })

3. Workspace 정보 조회
   gtm_workspace({ action: "get", workspaceId })

4. 변경 사항 조회
   gtm_workspace({ action: "getStatus", workspaceId })

5. 템플릿에 맞게 요약 생성
   - Container 이름 (타입 포함)
   - Workspace 이름
   - Workspace URL 생성
   - 변경 내용 정리

6. 사용자에게 결과 전달
```
