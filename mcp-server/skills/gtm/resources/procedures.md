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
// 3-Layer 체크
gtm_tag({ action: "list" })      // 태그명 중복
gtm_trigger({ action: "list" })  // 트리거명/이벤트명 중복
gtm_variable({ action: "list" }) // 변수명 중복
```

### 3. 생성

```javascript
// 순서: 변수 → 트리거 → 태그 → description
gtm_variable({ action: "create", ... })  // 필요시
gtm_trigger({ action: "create", ... })
gtm_tag({ action: "create", ... })
gtm_workspace({ action: "update", ... }) // description
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

## 기타 워크플로우

### Analyze

```javascript
gtm_tag({ action: "list" })
gtm_trigger({ action: "list" })
gtm_variable({ action: "list" })
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
