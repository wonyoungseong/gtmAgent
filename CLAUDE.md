# GTM Agent Project

이 프로젝트는 Google Tag Manager를 관리하는 MCP 서버입니다.

<important>
Sub-Agent는 AskUserQuestion 도구에 접근할 수 없습니다.
모든 사용자 질문은 메인 Claude가 AskUserQuestion으로 처리하세요.
</important>

<context_setup>
## 컨텍스트 설정 (필수 - 모든 GTM 작업 전에 실행)

GTM 작업을 시작하기 전에 **반드시 gtm_context로 환경을 먼저 설정**하세요.
한 번 설정하면 이후 모든 도구 호출에서 accountId/containerId/workspaceId를 생략할 수 있습니다.

### 워크플로우
```javascript
// 1. Account 목록 조회
gtm_account({ action: "list" })
// → AskUserQuestion으로 Account 선택

// 2. Container 목록 조회
gtm_container({ action: "list", accountId: "선택된ID" })
// → AskUserQuestion으로 Container 선택

// 3. Workspace 목록 조회
gtm_workspace({ action: "list", accountId: "...", containerId: "..." })
// → AskUserQuestion으로 Workspace 선택

// 4. 컨텍스트 설정 (한 번만 실행)
gtm_context({
  action: "set",
  accountId: "선택된ID",
  containerId: "선택된ID",
  workspaceId: "선택된ID"
})

// 5. 이후 모든 도구 호출에서 ID 생략 가능!
gtm_tag({ action: "list" })  // accountId, containerId, workspaceId 자동 사용
gtm_trigger({ action: "list" })
gtm_variable({ action: "list" })
```

### 컨텍스트 확인/초기화
```javascript
// 현재 컨텍스트 확인
gtm_context({ action: "get" })

// 컨텍스트 초기화 (다른 컨테이너로 전환 시)
gtm_context({ action: "clear" })
```
</context_setup>

<workflow name="Add Event">

<step number="1" title="환경 선택 및 컨텍스트 설정 (메인 Claude)">
1-1. Account + Container 선택
```javascript
gtm_account({ action: "list" })
gtm_container({ action: "list", accountId: "..." })
// → AskUserQuestion으로 선택 받기
```

1-2. Workspace 선택 (Container 선택 후)
```javascript
gtm_workspace({ action: "list", accountId, containerId })

// 워크스페이스 개수에 따른 분기 처리
if (workspaces.length < 3) {
  // 3개 미만: "새 Workspace 생성" 옵션 포함
  AskUserQuestion({
    question: "워크스페이스를 선택해주세요",
    options: [
      ...existingWorkspaces,
      { label: "새 Workspace 생성", description: "새로운 워크스페이스 생성" }
    ]
  })
} else {
  // 3개 제한 도달: 경고 메시지 + 기존 워크스페이스만 표시
  AskUserQuestion({
    question: "⚠️ 워크스페이스 제한(3개) 도달. 기존 워크스페이스를 선택하세요.",
    options: [...existingWorkspaces]  // 생성 옵션 없음
  })
}
```

1-3. **컨텍스트 설정 (Workspace 선택 후 필수!)**
```javascript
// 선택된 환경을 컨텍스트에 저장
gtm_context({
  action: "set",
  accountId: "선택된accountId",
  containerId: "선택된containerId",
  workspaceId: "선택된workspaceId"
})
// 이후 모든 gtm_tag, gtm_trigger 등에서 ID 생략 가능
```
</step>

<step number="2" title="이벤트 정보 수집 (메인 Claude)">
GTM 패턴 분석 후 AskUserQuestion으로 한번에 수집:

| 항목 | 설명 |
|------|------|
| Category | event_category 값 |
| Action | event_action 값 |
| Trigger Event | dataLayer에서 감지할 event명 |
| GA4 Event | GA4에 전송할 eventName |
| Trigger Type | CE/EV/CL 중 선택 |
| Tag Type | GA4/AD/HTML 중 선택 |
| Event Settings | 기존 변수 사용 여부 (GA4 선택 시) |
</step>

<step number="3" title="Sub-Agent Spawn">
모든 정보 수집 완료 후 Sub-Agent에게 생성 위임:

```javascript
Task({
  subagent_type: "general-purpose",
  description: "GTM 태그 생성",
  prompt: `
# GTM Agent

## 환경
- Account: {name} ({accountId})
- Container: {name} ({containerId})
- Workspace: {name} ({workspaceId})

## 이벤트 정보
- event_action: {action}
- event_category: {category}
- trigger_event_name: {trigger_event}
- ga4_event_name: {ga4_event}
- trigger_type: {CE/EV/CL}
- tag_type: {GA4/AD/HTML}
- event_settings: {변수명 또는 null}

## 태그명 결정 (필수!)
if (ga4_event_name === "custom_event") {
  태그명 = "GA4 - Custom Event - {Category} - {Action}"
} else if (tag_type === "AD") {
  태그명 = "AD - {Platform} - {Event}"
} else {
  태그명 = "GA4 - {Category} - {Action}"
}

## 규칙
- SKILL.md 참조 필수
- 생성 후 workspace description 업데이트
- 사용자에게 추가 질문하지 않기
`
})
```
</step>

</workflow>

<tag_naming_patterns>
| 조건 | 패턴 | 예시 |
|------|------|------|
| GA4 일반 | `GA4 - {Category} - {Action}` | GA4 - ETC - Start Camera |
| GA4 custom_event | `GA4 - Custom Event - {Category} - {Action}` | GA4 - Custom Event - BTS - Start Test |
| AD | `AD - {Platform} - {Event}` | AD - Meta - Purchase |
| HTML | `HTML - {Description}` | HTML - Set Cookie Flag |
</tag_naming_patterns>

<safety_rules>
- list, get: 자유롭게 사용
- create, update: 사용자 승인 후 실행
- remove, publish: 사용하지 마세요
</safety_rules>

<migration_naming_convention>
## Migration Naming Convention (필수!)

**태그/트리거/변수를 다른 프로퍼티로 이식(copy/migration)할 때, SOURCE가 아닌 TARGET 프로퍼티의 네이밍 컨벤션을 따르세요.**

### 핵심 원칙
```
❌ 잘못된 접근: SOURCE 프로퍼티의 패턴을 그대로 복사
✅ 올바른 접근: TARGET 프로퍼티의 기존 패턴을 분석하고 적용
```

### 패턴 분석 시 필수 확인 (중요!)
- **모든 태그/트리거/변수를 페이지네이션까지 확인**하세요
- 첫 페이지만 보고 "패턴이 없다"고 단정하지 마세요
- 특히 Custom HTML, Custom Event 등 특정 타입의 prefix를 정확히 파악하세요

### 워크플로우
```
1. SOURCE에서 이식할 로직/기능 파악
   ↓
2. TARGET의 모든 엔티티 조회 (전체 페이지)
   ├── gtm_tag({ action: "list", ... })
   ├── gtm_trigger({ action: "list", ... })
   └── gtm_variable({ action: "list", ... })
   ↓
3. TARGET 네이밍 패턴 분석
   ├── Tag prefix: HTML -, cHTML -, GA4 - 등
   ├── Trigger prefix: CE -, EV -, CL - 등
   └── Variable prefix: JS -, jsVar -, dlv - 등
   ↓
4. SOURCE 이름 → TARGET 컨벤션으로 변환
   ↓
5. 사용자 확인 후 생성
```

### 예시
| SOURCE 이름 | TARGET 기존 패턴 | 적용할 이름 |
|------------|-----------------|-------------|
| `HTML - Push Event` | TARGET에 `cHTML -` 사용 | `cHTML - Push Event` |
| `HTML - Push Event` | TARGET에 `HTML -` 사용 | `HTML - Push Event` |
| `JS - Flag` | TARGET에 `jsVar -` 사용 | `jsVar - Flag` |

**⚠️ TARGET 프로퍼티가 항상 기준입니다. SOURCE 패턴을 무조건 따르지 마세요.**
</migration_naming_convention>

<migration_duplicate_check>
## Migration 중복 검사 (설정값 기준 - 필수!)

**이름이 달라도 동일한 설정을 가진 컴포넌트가 존재할 수 있습니다.**
마이그레이션 전 반드시 "설정값 기준" 중복 검사를 수행하세요.

### 핵심 원칙
```
❌ 잘못된 접근: 이름만 비교하여 중복 판단
   예: "DL - AP CLICK"과 "DL - AP CLICK NAME"은 이름이 다르므로 중복 아님

✅ 올바른 접근: 실제 설정값을 비교하여 중복 판단
   예: 둘 다 dataLayer의 "ap_click_name"을 참조 → 중복!
```

### 컴포넌트별 비교 필드

| 컴포넌트 | 비교 필드 | 예시 |
|----------|----------|------|
| **변수 (v/k)** | `type` + `parameter[name/key]` | DataLayer `ap_click_name`, Cookie `bdp_flag` |
| **트리거 (CE)** | `type` + `customEventFilter.value` | Custom Event `ap_click` |
| **트리거 (EV)** | `type` + `elementSelector` + `onScreenRatio` | CSS `.btn-class` 50% |
| **태그 (GA4)** | `type` + `eventName` | `gaawe` + `qualified_visit` |
| **태그 (HTML)** | `type` + 핵심 로직 (이벤트명, 쿠키명 등) | `html` + `ap_scroll_50` push |

### 중복 검사 워크플로우
```
1. SOURCE 컴포넌트의 "핵심 설정값" 추출
   ├── 변수: 참조하는 dataLayer key 또는 cookie name
   ├── 트리거: 감지하는 event name 또는 selector
   └── 태그: 발생시키는 event name 또는 핵심 로직

2. TARGET의 모든 컴포넌트 조회 (전체 페이지)

3. 설정값 기준 중복 검사
   ├── 이름 일치 체크
   └── 설정값 일치 체크 ← 핵심!

4. 중복 발견 시 처리
   ├── 완전 중복: 생성 스킵, 기존 ID 사용
   ├── 부분 중복: 사용자에게 확인 요청
   └── 중복 없음: 새로 생성
```

### 예시: 변수 중복 검사
```javascript
// SOURCE 변수: "DL - AP CLICK NAME" (key: ap_click_name)
// TARGET 변수 조회
gtm_variable({ action: "list", ... })

// TARGET에서 발견:
// - "DL - AP CLICK" (key: ap_click_name) ← 설정값 동일!

// 결과: 이름은 다르지만 동일 설정 → 기존 변수 재사용
```

**⚠️ 상세 검사 절차는 `procedures.md`의 "중복 검사 상세 절차" 섹션 참조**
</migration_duplicate_check>

<dependency_tracing>
## 의존성 역추적 (Migration 필수!)

**변수/트리거/태그만 복사하면 안 됩니다. 데이터의 출처까지 추적해야 합니다.**

### 핵심 원칙
```
❌ 잘못된 접근: 변수가 참조하는 값이 당연히 존재한다고 가정
   예: DL - Session ID가 gtagApiResult.session_id 참조 → "dataLayer에 있겠지"

✅ 올바른 접근: 값의 출처를 역추적하여 생성 컴포넌트 확인
   예: gtagApiResult.session_id → 어떤 태그/템플릿이 이 값을 push하는가?
```

### 역추적이 필요한 패턴

| 변수 참조값 | 질문 | 확인 대상 |
|------------|------|----------|
| `gtagApiResult.*` | 이 값을 push하는 태그는? | Template (GTAG API Get 등) |
| `ecommerce.*` | 이 값을 push하는 코드는? | HTML 태그 또는 웹사이트 코드 |
| Custom dataLayer key | 이 이벤트를 발생시키는 태그는? | HTML 태그, 다른 Custom Event |
| Cookie 값 | 이 쿠키를 설정하는 태그는? | HTML 태그 (document.cookie) |

### 역추적 워크플로우
```
1. SOURCE 변수의 참조값 확인
   └── 예: gtagApiResult.session_id

2. 해당 값을 생성하는 컴포넌트 검색
   ├── gtm_tag({ action: "list" }) → HTML 태그에서 dataLayer.push 검색
   ├── gtm_template({ action: "list" }) → Custom Template 확인
   └── 태그의 teardownTag/setupTag 연결 확인

3. 생성 컴포넌트의 트리거 확인
   └── 예: Config Tag의 teardownTag로 실행됨

4. 전체 실행 체인 파악
   └── Config → Template → Event → Trigger → Tag

5. TARGET에 필요한 모든 컴포넌트 목록 작성
   └── Template 포함!
```

### 주요 체크 포인트

| 체크 | 확인 방법 |
|------|----------|
| **Custom Template 의존성** | `type: "cvt_*"` 태그 → 해당 Template 필요 |
| **teardownTag 체인** | 태그의 `teardownTag` 속성 확인 |
| **setupTag 체인** | 태그의 `setupTag` 속성 확인 |
| **dataLayer 값 출처** | 변수가 참조하는 key를 push하는 태그 검색 |

### 예시: Qualified Visit 시스템
```
DL - Session ID (변수)
  └── 참조: gtagApiResult.session_id
      └── 출처: GA4 - ETC - Session ID Fetch (Template 태그)
          └── 트리거: Config Tag의 teardownTag
              └── 필요: cvt_KDDGR Template + Config Tag 연결
```

**⚠️ 상세 절차는 `procedures.md`의 "의존성 역추적 상세 절차" 섹션 참조**
</dependency_tracing>

<template_migration>
## Custom Template 마이그레이션

Custom Template(`cvt_*` 타입)은 API로 직접 생성하기 어렵습니다.
**템플릿 파일(.tpl)을 export하여 사용자가 GTM UI에서 import하는 방식**을 사용합니다.

### 워크플로우
```
1. SOURCE Container export
   gtm_export_full({ versionType: "live", outputPath: "..." })

2. 템플릿 데이터 추출 (.tpl 파일 생성)
   node -e "... templateData를 .tpl 파일로 저장"

3. 사용자에게 파일 경로 안내 + GTM Import 방법 안내

4. 사용자가 GTM UI에서 Import 완료 후 진행
```

### 템플릿 추출 코드
```javascript
// Node.js로 templateData 추출
node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('SOURCE_EXPORT.json', 'utf8'));
  const template = data.fullData.customTemplate.find(t => t.templateId === 'TARGET_ID');
  fs.writeFileSync('TEMPLATE_NAME.tpl', template.templateData);
"
```

### GTM Import 안내 메시지
```
## 템플릿 파일 정보
- 파일 경로: {경로}
- 템플릿명: {이름}

## GTM에서 Import 방법
1. GTM UI → TARGET Container
2. Templates 메뉴 클릭
3. Tag Templates > New 클릭
4. 우측 상단 ⋮ 메뉴 > Import 선택
5. .tpl 파일 선택
6. Save 클릭
```

### 주의사항
- Community Template은 Gallery에서 직접 추가하는 것도 가능
- API로 templateData 복사 시 라이센스/업데이트 문제 가능
- 사용자가 Import 완료 확인 후 다음 단계 진행
</template_migration>

<tag_analysis_rules>
## 태그 분석 시 필수 확인 사항

### 1. Tag Sequencing (Setup Tag / Cleanup Tag) 반드시 확인
태그의 실행 흐름을 파악할 때 **firingTriggerId만으로는 불완전**합니다.
반드시 다음을 함께 확인하세요:

| 속성 | 설명 | 확인 방법 |
|------|------|-----------|
| `firingTriggerId` | 직접 연결된 트리거 | 태그 조회 시 확인 |
| `setupTag` | 이 태그 실행 **전에** 실행되는 태그 | 태그 조회 시 확인 |
| `teardownTag` | 이 태그 실행 **후에** 실행되는 태그 (Cleanup) | 태그 조회 시 확인 |

### 2. 태그 연결 구조 파악 프로세스
```javascript
// 1. 태그 목록 조회
gtm_tag({ action: "list", ... })

// 2. 각 태그의 setupTag, teardownTag 확인
for (tag of tags) {
  if (tag.setupTag) {
    // 이 태그는 다른 태그의 Setup으로 실행됨
    console.log(tag.name + " → Setup: " + tag.setupTag.map(t => t.tagName))
  }
  if (tag.teardownTag) {
    // 이 태그 실행 후 Cleanup 태그가 실행됨
    console.log(tag.name + " → Cleanup: " + tag.teardownTag.map(t => t.tagName))
  }
}
```

### 3. 트리거가 없는 태그 주의
`firingTriggerId`가 없는 태그는 **다른 태그의 Setup/Cleanup으로만 실행**됩니다.
이런 태그를 발견하면 어떤 태그에서 참조하는지 반드시 역추적하세요.

### 4. 실행 흐름 예시
```
[Trigger 발동]
      ↓
[Setup Tag] (있으면 먼저 실행)
      ↓
[Main Tag] (본 태그 실행)
      ↓
[Cleanup Tag] (있으면 나중에 실행)
```

### 5. 분석 보고 시 포함할 정보
태그 분석 결과를 보고할 때 반드시 다음을 포함:
- 직접 트리거 (firingTriggerId)
- Setup Tag 연결 여부
- Cleanup Tag 연결 여부
- 이 태그를 참조하는 다른 태그 (역방향 참조)
</tag_analysis_rules>

<cache_rules>
## 캐시 자동 갱신 규칙

MCP 서버는 태그/트리거/변수 목록을 캐시합니다.

### 반드시 refresh: true 사용해야 하는 상황
| 감지 키워드 | 조치 |
|------------|------|
| "방금 수정했어", "GTM에서 변경" | `refresh: true` |
| "최신 데이터", "새로고침" | `refresh: true` |
| create/update 직후 list 호출 | `refresh: true` |
| 사용자가 예상과 다른 결과 언급 | `refresh: true` |

```javascript
// 예시: 사용자가 "방금 GTM에서 수정했어"
gtm_tag({ action: "list", ..., refresh: true })

// 예시: 태그 생성 후 목록 재조회
await gtm_tag({ action: "create", ... });
gtm_tag({ action: "list", ..., refresh: true });

// 캐시 수동 초기화
gtm_cache({ action: "clear", accountId, containerId, workspaceId })
```
</cache_rules>

<summary_templates>
## 요약 템플릿 선택 규칙 (중요!)

GTM 작업 후 요약/설명 작성 시 **용도에 맞는 템플릿**을 선택해야 합니다.

### 템플릿 종류

| 용도 | 템플릿 파일 | 사용 시점 |
|------|------------|----------|
| **Jira 배포 요청** | `skills/gtm-reviewer-summary.md` | 검토자/확인자에게 운영 배포 승인 요청 시 |
| **GTM Workspace Description** | `skills/gtm/resources/references/workspace.md` | GTM 내부 버전 관리용 설명 작성 시 |

### 키워드 기반 자동 판단

```
사용자 요청에 포함된 키워드:
├─ "Jira", "배포 요청", "운영 배포", "검토자", "확인자", "description 배포"
│   └─ → gtm-reviewer-summary.md 사용
├─ "workspace description", "버전 설명", "GTM 설명"
│   └─ → workspace.md 참조
└─ 불명확한 경우
    └─ → 반드시 AskUserQuestion으로 확인!
```

### 불명확할 때 질문 (필수!)

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

### Jira 배포 요청 형식 예시

```
GTM Container: [EC] INNISFREE - KR

Work Space Name: qualifiedVisitScrollDepth50

Work Space URL: https://tagmanager.google.com/#/container/accounts/.../workspaces/...

수정 내용:
- CE - Ap Scroll 50% (트리거 이벤트명 변경)
- HTML - Push Qualified Visit Event (이벤트 라벨 값 변경: 90% -> 50%)
```

### GTM Workspace Description 형식 예시

```
이름: "JIRA-456 start_camera"
설명: "Ticket: JIRA-456 | 작업: start_camera 이벤트 추가 | 상세: CE trigger + GA4 tags | 2024-12-28"
```
</summary_templates>

<references>
| 문서 | 용도 |
|------|------|
| mcp-server/skills/gtm/SKILL.md | Sub-Agent 규칙 |
| mcp-server/skills/gtm/resources/procedures.md | 상세 절차 |
| mcp-server/skills/gtm-reviewer-summary.md | Jira 배포 요청용 요약 |
| mcp-server/skills/gtm/resources/references/workspace.md | GTM Workspace 설명 |
</references>
