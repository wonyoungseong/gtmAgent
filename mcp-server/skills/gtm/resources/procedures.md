# GTM Procedures

상세 절차 참조 문서

---

## Add Event 절차

### 1. GTM 패턴 분석

```javascript
// 기존 태그에서 패턴 추출
gtm_tag({ action: "list" })

// 추출할 정보:
// - 태그명 prefix (GA4, AD, HTML 등)
// - event_category 값 및 케이스
// - event_action 값 및 케이스
```

### 2. 중복 체크

```javascript
// 3-Layer 체크 - 병렬 조회 (동시 실행)
// ├── gtm_tag({ action: "list" })      // 태그명 중복
// ├── gtm_trigger({ action: "list" })  // 트리거명/이벤트명 중복
// └── gtm_variable({ action: "list" }) // 변수명 중복
```

### 3. 생성

```javascript
// 3-1. 병렬 생성 (의존성 없음)
// ├── gtm_variable({ action: "create", ... })  // 필요시
// └── gtm_trigger({ action: "create", ... })
//
// 3-2. 태그 생성 (트리거 ID 필요)
// └── gtm_tag({ action: "create", ... })
//
// 3-3. description 업데이트
// └── gtm_workspace({ action: "update", ... })
```

---

## 트리거 생성 예시

### CE - Custom Event (단순)

```javascript
gtm_trigger({
  action: "create",
  createOrUpdateConfig: {
    name: "CE - Start Camera",
    type: "customEvent",
    customEventFilter: [{
      type: "equals",
      parameter: [
        { key: "arg0", type: "template", value: "{{_event}}" },
        { key: "arg1", type: "template", value: "start_camera" }
      ]
    }]
  }
})
```

### CE - Custom Event + 조건 (Cookie 체크)

```javascript
gtm_trigger({
  action: "create",
  createOrUpdateConfig: {
    name: "CE - Qualified Visit",
    type: "customEvent",
    customEventFilter: [{
      type: "equals",
      parameter: [
        { key: "arg0", type: "template", value: "{{_event}}" },
        { key: "arg1", type: "template", value: "qualified_visit" }
      ]
    }],
    filter: [{
      type: "equals",
      parameter: [
        { key: "arg0", type: "template", value: "{{Cookie - BDP Flag}}" },
        { key: "arg1", type: "template", value: "N" }
      ]
    }]
  }
})
```

### EV - Element Visibility

```javascript
gtm_trigger({
  action: "create",
  createOrUpdateConfig: {
    name: "EV - Content Impression",
    type: "elementVisibility",
    parameter: [
      { key: "selectorType", type: "template", value: "CSS" },
      { key: "elementSelector", type: "template", value: ".content-class" },
      { key: "onScreenRatio", type: "template", value: "50" },
      { key: "firingFrequency", type: "template", value: "ONCE_PER_PAGE" },
      { key: "useDomChangeListener", type: "boolean", value: "true" }
    ]
  }
})
```

---

## 태그 생성 예시

### GA4 Event

```javascript
gtm_tag({
  action: "create",
  createOrUpdateConfig: {
    name: "GA4 - ETC - Start Camera",
    type: "gaawe",
    parameter: [
      { key: "eventName", type: "template", value: "start_camera" },
      { key: "measurementIdOverride", type: "template", value: "{{GA4 - MeasurementID}}" },
      { key: "eventSettingsVariable", type: "template", value: "{{GT - Event Settings}}" },
      { key: "eventSettingsTable", type: "list", list: [
        { type: "map", map: [
          { key: "parameter", type: "template", value: "event_category" },
          { key: "parameterValue", type: "template", value: "etc" }
        ]},
        { type: "map", map: [
          { key: "parameter", type: "template", value: "event_action" },
          { key: "parameterValue", type: "template", value: "start_camera" }
        ]}
      ]}
    ],
    firingTriggerId: ["{triggerId}"]
  }
})
```

---

## 변수 생성 예시

### Cookie 변수

```javascript
gtm_variable({
  action: "create",
  createOrUpdateConfig: {
    name: "Cookie - BDP Flag",
    type: "k",  // 1st Party Cookie
    parameter: [
      { key: "name", type: "template", value: "bdp_flag" }
    ]
  }
})
```

### Data Layer 변수

```javascript
gtm_variable({
  action: "create",
  createOrUpdateConfig: {
    name: "DL - Event Action",
    type: "v",  // Data Layer Variable
    parameter: [
      { key: "name", type: "template", value: "event_action" },
      { key: "dataLayerVersion", type: "integer", value: "2" }
    ]
  }
})
```

---

## Custom Template 마이그레이션 절차

Custom Template(`cvt_*` 타입)은 templateData가 매우 커서 API 응답이 토큰 제한을 초과합니다.
**.tpl 파일로 export하여 사용자가 GTM UI에서 import**하는 방식을 사용합니다.

### 1. Template 의존성 발견

```javascript
// 태그 목록에서 cvt_* 타입 발견
const tags = await gtm_tag({ action: "list", ... });
const templateTags = tags.filter(t => t.type.startsWith("cvt_"));

// 예: type: "cvt_KDDGR" → GTAG GET API 템플릿 필요
```

### 2. SOURCE Container Export

```javascript
// 전체 container를 파일로 export
gtm_export_full({
  accountId: "SOURCE_ACCOUNT_ID",
  containerId: "SOURCE_CONTAINER_ID",
  versionType: "live",  // 또는 "workspace"
  outputPath: "C:/path/to/source_export.json"
})
```

### 3. 템플릿 데이터 추출 (.tpl 파일 생성)

```bash
# Node.js로 특정 템플릿의 templateData만 추출
node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('source_export.json', 'utf8'));
  const template = data.fullData.customTemplate.find(t => t.templateId === '583');
  fs.writeFileSync('GTAG_GET_API.tpl', template.templateData);
  console.log('Exported:', template.name);
"
```

### 4. 사용자에게 안내 메시지

```markdown
## 템플릿 파일 정보

| 항목 | 값 |
|------|-----|
| **파일 경로** | `C:\path\to\TEMPLATE_NAME.tpl` |
| **템플릿명** | GTAG GET API |
| **원본** | Simo Ahava (gtm-templates-simo-ahava) |

---

## GTM에서 Import 방법

1. **GTM UI 접속** → TARGET Container
2. **Templates** 메뉴 클릭
3. **Tag Templates** 섹션에서 **New** 클릭
4. 우측 상단 **⋮ (더보기)** 메뉴 클릭
5. **Import** 선택
6. `.tpl` 파일 선택
7. **Save** 클릭

---

Import 완료되면 알려주세요.
```

### 5. Import 완료 후 태그 생성

```javascript
// 사용자가 Import 완료 확인 후
// TARGET에서 새로 생성된 템플릿 타입 확인
const templates = await gtm_template({ action: "list", ... });
const newTemplate = templates.find(t => t.name === "GTAG GET API");
// → type: "cvt_XXXXX" (새로운 ID 부여됨)

// 해당 타입으로 태그 생성
gtm_tag({
  action: "create",
  createOrUpdateConfig: {
    name: "GA4 - ETC - Session ID Fetch",
    type: newTemplate.templateId,  // 또는 cvt_ + templateId
    parameter: [...],
    // teardownTag/setupTag 연결 등
  }
})
```

### 6. Community Template 대안

Community Template Gallery에 있는 템플릿은 GTM UI에서 직접 추가 가능:

```markdown
## 대안: Community Template Gallery에서 추가

1. GTM UI → Templates → Search Gallery
2. "gtag get api" 검색
3. Simo Ahava 템플릿 선택 → Add to workspace
```

---

## 의존성 역추적 상세 절차 (Migration 필수)

마이그레이션 시 변수/트리거/태그뿐 아니라 **데이터의 출처**까지 추적해야 합니다.

### 1. 변수 참조값 출처 추적

```javascript
// SOURCE 변수 분석
const sourceVar = await gtm_variable({ action: "get", variableId: "..." });
const refKey = sourceVar.parameter?.find(p => p.key === "name")?.value;

// 예: refKey = "gtagApiResult.session_id"

// 이 값을 생성하는 태그 검색
const allTags = [...]; // 전체 페이지 조회

for (const tag of allTags) {
  // 1. Custom Template 태그 확인
  if (tag.type.startsWith("cvt_")) {
    // Community Template - 어떤 값을 push하는지 확인 필요
    console.log(`Template 태그 발견: ${tag.name} (${tag.type})`);
  }

  // 2. HTML 태그에서 dataLayer.push 검색
  if (tag.type === "html") {
    const html = tag.parameter?.find(p => p.key === "html")?.value;
    if (html && html.includes(refKey.split(".")[0])) {
      console.log(`dataLayer push 발견: ${tag.name}`);
    }
  }
}
```

### 2. teardownTag / setupTag 체인 확인

```javascript
// 태그의 실행 체인 분석
for (const tag of allTags) {
  // teardownTag 확인 (이 태그 실행 후 실행되는 태그)
  if (tag.teardownTag) {
    for (const teardown of tag.teardownTag) {
      console.log(`${tag.name} → teardownTag: ${teardown.tagName}`);
      // teardown 태그도 마이그레이션 대상에 포함!
    }
  }

  // setupTag 확인 (이 태그 실행 전 실행되는 태그)
  if (tag.setupTag) {
    for (const setup of tag.setupTag) {
      console.log(`${tag.name} ← setupTag: ${setup.tagName}`);
      // setup 태그도 마이그레이션 대상에 포함!
    }
  }
}
```

### 3. Custom Template 의존성 확인

```javascript
// type이 cvt_로 시작하는 태그 → Custom Template 필요
const templateDependentTags = allTags.filter(t => t.type.startsWith("cvt_"));

for (const tag of templateDependentTags) {
  console.log(`Template 의존: ${tag.name} → ${tag.type}`);

  // SOURCE의 Template 목록에서 해당 템플릿 찾기
  const templates = await gtm_template({ action: "list", ... });
  const requiredTemplate = templates.find(t =>
    tag.type.includes(t.templateId)
  );

  if (requiredTemplate) {
    console.log(`필요한 Template: ${requiredTemplate.name}`);
    // TARGET에 동일 Template이 있는지 확인 필요
  }
}
```

### 4. 전체 의존성 체인 파악 예시

```
[Qualified Visit 시스템 의존성 체인]

DL - Session ID (변수)
  │ 참조: gtagApiResult.session_id
  ↓
GA4 - ETC - Session ID Fetch (태그, type: cvt_KDDGR)
  │ 이 값을 dataLayer에 push
  │ gtagApiGet 이벤트 발생
  ↓
GA4 - Basic Event - Page View (Config) (태그)
  │ teardownTag로 Session ID Fetch 호출
  ↓
cvt_KDDGR Template (Custom Template)
  │ Session ID Fetch 태그가 사용하는 템플릿
  ↓

[마이그레이션 필요 목록]
✅ 변수: DL - Session ID, Cookie - BDP GA4 Session ID, ...
✅ 트리거: CE - Gtag API Get, CE - Qualified Visit, ...
✅ 태그: HTML tags, GA4 tags, Session ID Fetch
✅ Template: GTAG API Get (cvt_KDDGR 또는 동등한 것)
✅ Config Tag 연결: teardownTag 설정 필요
```

### 5. 의존성 검사 체크리스트

| 단계 | 확인 항목 | 확인 방법 |
|------|----------|----------|
| 1 | 변수 참조값 목록 | 모든 변수의 `parameter[name]` 값 |
| 2 | 참조값 출처 태그 | HTML 태그의 dataLayer.push 검색 |
| 3 | Custom Template 의존 | `type: "cvt_*"` 태그 목록 |
| 4 | teardownTag 체인 | 모든 태그의 `teardownTag` 속성 |
| 5 | setupTag 체인 | 모든 태그의 `setupTag` 속성 |
| 6 | TARGET Template 확인 | TARGET에 동일/유사 Template 존재 여부 |

### 6. 의존성 보고 형식

```
## 의존성 분석 결과

### 변수 참조값 출처
| 변수 | 참조값 | 출처 태그 | 출처 타입 |
|------|--------|----------|----------|
| DL - Session ID | gtagApiResult.session_id | GA4 - ETC - Session ID Fetch | cvt_KDDGR |

### Tag Sequencing 연결
| Main Tag | Setup Tag | Teardown Tag |
|----------|-----------|--------------|
| GA4 - Config | - | GA4 - ETC - Session ID Fetch |
| GA4 - Qualified Visit | - | HTML - Set BDP Event Flag |

### Custom Template 의존성
| 태그 | Template Type | TARGET 존재 여부 |
|------|--------------|-----------------|
| GA4 - ETC - Session ID Fetch | cvt_KDDGR | ❌ 없음 → 생성 필요 |

### 마이그레이션 대상 총 목록
- 변수: 3개
- 트리거: 5개
- 태그: 7개
- **Template: 1개** ← 놓치기 쉬움!
```

---

## 중복 검사 상세 절차 (Migration 필수)

마이그레이션 시 이름뿐 아니라 **실제 설정값**을 기준으로 중복을 검사해야 합니다.

### 1. 변수 중복 검사

```javascript
// SOURCE 변수의 핵심 설정값 추출
const sourceVar = await gtm_variable({ action: "get", variableId: "..." });

// 설정값 추출
const sourceKey = sourceVar.parameter.find(p => p.key === "name")?.value;  // DataLayer key
const sourceType = sourceVar.type;  // v (DataLayer), k (Cookie), j (JavaScript) 등

// TARGET 전체 변수 조회 (모든 페이지)
let page = 1;
let allVariables = [];
while (true) {
  const result = await gtm_variable({ action: "list", page, itemsPerPage: 20 });
  allVariables.push(...result.variable);
  if (!result.variable || result.variable.length < 20) break;
  page++;
}

// 설정값 기준 중복 검사
for (const targetVar of allVariables) {
  const targetKey = targetVar.parameter?.find(p => p.key === "name")?.value;

  if (sourceType === targetVar.type && sourceKey === targetKey) {
    console.log(`중복 발견: ${sourceVar.name} ↔ ${targetVar.name}`);
    console.log(`동일 설정: type=${sourceType}, key=${sourceKey}`);
    // → 기존 변수 ID 사용, 새로 생성하지 않음
  }
}
```

### 2. 트리거 중복 검사

```javascript
// SOURCE 트리거의 핵심 설정값 추출
const sourceTrigger = await gtm_trigger({ action: "get", triggerId: "..." });

// Custom Event 트리거
if (sourceTrigger.type === "customEvent") {
  const sourceEvent = sourceTrigger.customEventFilter?.[0]?.parameter
    ?.find(p => p.key === "arg1")?.value;

  // TARGET 전체 트리거 조회
  const allTriggers = [...]; // 전체 페이지 조회

  for (const targetTrigger of allTriggers) {
    if (targetTrigger.type !== "customEvent") continue;

    const targetEvent = targetTrigger.customEventFilter?.[0]?.parameter
      ?.find(p => p.key === "arg1")?.value;

    if (sourceEvent === targetEvent) {
      console.log(`중복 발견: ${sourceTrigger.name} ↔ ${targetTrigger.name}`);
      console.log(`동일 이벤트: ${sourceEvent}`);
      // → 추가 조건(filter) 비교 후 판단
    }
  }
}

// Element Visibility 트리거
if (sourceTrigger.type === "elementVisibility") {
  const sourceSelector = sourceTrigger.parameter?.find(p => p.key === "elementSelector")?.value;
  const sourceRatio = sourceTrigger.parameter?.find(p => p.key === "onScreenRatio")?.value;

  // TARGET에서 동일 selector + ratio 검색
}
```

### 3. 태그 중복 검사

```javascript
// SOURCE 태그의 핵심 설정값 추출
const sourceTag = await gtm_tag({ action: "get", tagId: "..." });

// GA4 Event 태그
if (sourceTag.type === "gaawe") {
  const sourceEventName = sourceTag.parameter?.find(p => p.key === "eventName")?.value;

  // TARGET 전체 태그 조회
  const allTags = [...]; // 전체 페이지 조회

  for (const targetTag of allTags) {
    if (targetTag.type !== "gaawe") continue;

    const targetEventName = targetTag.parameter?.find(p => p.key === "eventName")?.value;

    if (sourceEventName === targetEventName) {
      console.log(`중복 발견: ${sourceTag.name} ↔ ${targetTag.name}`);
      console.log(`동일 GA4 이벤트: ${sourceEventName}`);
      // → eventParameters까지 비교하여 완전 중복 여부 판단
    }
  }
}

// Custom HTML 태그
if (sourceTag.type === "html") {
  const sourceHtml = sourceTag.parameter?.find(p => p.key === "html")?.value;

  // HTML에서 핵심 로직 추출 (이벤트명, 쿠키명 등)
  const sourceEventMatch = sourceHtml.match(/['"](\w+_\w+)['"]/g);  // 이벤트명 패턴
  const sourceCookieMatch = sourceHtml.match(/document\.cookie\s*=\s*['"](\w+)/g);  // 쿠키명

  // TARGET HTML 태그들과 핵심 로직 비교
}
```

### 4. 중복 발견 시 처리 방법

| 상황 | 처리 방법 |
|------|----------|
| **완전 중복** (이름+설정 동일) | 생성 스킵, 기존 ID 사용 |
| **설정 중복** (이름만 다름) | 기존 ID 사용, 사용자에게 알림 |
| **부분 중복** (일부 설정만 동일) | 사용자에게 확인 요청 |
| **중복 없음** | TARGET 네이밍 컨벤션으로 새로 생성 |

### 5. 검사 결과 보고 형식

```
## 중복 검사 결과

### 변수
| SOURCE | TARGET 일치 | 설정값 | 처리 |
|--------|------------|--------|------|
| DL - AP CLICK NAME | DL - AP CLICK | ap_click_name | 기존 ID 사용 |
| Cookie - Flag | (없음) | bdp_flag | 새로 생성 |

### 트리거
| SOURCE | TARGET 일치 | 설정값 | 처리 |
|--------|------------|--------|------|
| CE - Scroll 50 | (없음) | ap_scroll_50 | 새로 생성 |

### 태그
| SOURCE | TARGET 일치 | 설정값 | 처리 |
|--------|------------|--------|------|
| GA4 - Qualified Visit | (없음) | qualified_visit | 새로 생성 |
```

---

## 기타 워크플로우

### Analyze

```javascript
// 병렬 조회 (동시 실행)
// ├── gtm_tag({ action: "list" })
// ├── gtm_trigger({ action: "list" })
// └── gtm_variable({ action: "list" })
// 요약: 수량, 네이밍 패턴, 미사용 항목
```

### Search

```javascript
gtm_tag({ action: "list" })      // name으로 검색
gtm_trigger({ action: "list" })  // event명으로 검색
```

### Update

```javascript
gtm_tag({ action: "get", tagId })  // fingerprint 획득
gtm_tag({ action: "update", tagId, fingerprint, createOrUpdateConfig })
```

### Export

```javascript
gtm_export_full({
  accountId,
  containerId,
  versionType: "live" | "workspace"
})
```
