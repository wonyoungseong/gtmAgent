/**
 * GTM Entity Parsers
 * 태그/트리거/변수에서 의존성 참조 추출
 */

import {
  EntityType,
  GTMTag,
  GTMTrigger,
  GTMVariable,
  GTMParameter,
  GTMFilter
} from '../types/gtm';
import { DependencyEdge, DependencyType } from '../types/dependency';
import { extractTemplateEvents } from './known-event-pushers';

// ==================== Tag Parser ====================

/**
 * 태그에서 의존성 추출
 */
export function extractTagDependencies(tag: GTMTag): DependencyEdge[] {
  const dependencies: DependencyEdge[] = [];

  // 1. Firing Triggers
  if (tag.firingTriggerId) {
    for (const triggerId of tag.firingTriggerId) {
      dependencies.push({
        targetId: triggerId,
        targetType: EntityType.TRIGGER,
        dependencyType: DependencyType.FIRING_TRIGGER,
        location: 'firingTriggerId'
      });
    }
  }

  // 2. Blocking Triggers
  if (tag.blockingTriggerId) {
    for (const triggerId of tag.blockingTriggerId) {
      dependencies.push({
        targetId: triggerId,
        targetType: EntityType.TRIGGER,
        dependencyType: DependencyType.BLOCKING_TRIGGER,
        location: 'blockingTriggerId'
      });
    }
  }

  // 3. Setup Tags
  if (tag.setupTag) {
    for (const setup of tag.setupTag) {
      // tagId가 있으면 사용, 없으면 tagName으로 name: 형식 사용
      const targetId = setup.tagId || (setup.tagName ? `name:${setup.tagName}` : undefined);
      if (targetId) {
        dependencies.push({
          targetId,
          targetType: EntityType.TAG,
          dependencyType: DependencyType.SETUP_TAG,
          location: 'setupTag',
          tagName: setup.tagName
        });
      }
    }
  }

  // 4. Teardown Tags
  if (tag.teardownTag) {
    for (const teardown of tag.teardownTag) {
      // tagId가 있으면 사용, 없으면 tagName으로 name: 형식 사용
      const targetId = teardown.tagId || (teardown.tagName ? `name:${teardown.tagName}` : undefined);
      if (targetId) {
        dependencies.push({
          targetId,
          targetType: EntityType.TAG,
          dependencyType: DependencyType.TEARDOWN_TAG,
          location: 'teardownTag',
          tagName: teardown.tagName
        });
      }
    }
  }

  // 5. Parameters (변수 참조)
  if (tag.parameter) {
    const paramDeps = extractParameterDependencies(tag.parameter, 'parameter');
    dependencies.push(...paramDeps);

    // GA4 Config Tag 참조 (configTagId)
    const configTagParam = tag.parameter.find(p => p.key === 'configTagId');
    if (configTagParam?.value) {
      dependencies.push({
        targetId: configTagParam.value,
        targetType: EntityType.TAG,
        dependencyType: DependencyType.CONFIG_TAG_REF,
        location: 'parameter.configTagId'
      });
    }
  }

  // 6. Template 참조 (커스텀 템플릿 태그)
  // GTM에서 커스텀 템플릿을 사용하는 태그는 type이 "cvt_XXX" 형태
  // templateId 필드는 없고, type 자체가 템플릿 식별자 역할
  if (tag.type?.startsWith('cvt_')) {
    dependencies.push({
      targetId: `cvt:${tag.type}`,  // cvt: prefix로 템플릿 type 참조 표시
      targetType: EntityType.TEMPLATE,
      dependencyType: DependencyType.TEMPLATE_PARAM,
      location: 'type',
      note: `Custom template type: ${tag.type}`
    });
  }

  return dependencies;
}

// ==================== Trigger Parser ====================

/**
 * 트리거에서 의존성 추출
 */
export function extractTriggerDependencies(trigger: GTMTrigger): DependencyEdge[] {
  const dependencies: DependencyEdge[] = [];

  // 1. Parameters
  if (trigger.parameter) {
    const paramDeps = extractParameterDependencies(trigger.parameter, 'parameter');
    dependencies.push(...paramDeps);
  }

  // 2. Filter
  if (trigger.filter) {
    const filterDeps = extractFilterDependencies(trigger.filter, 'filter');
    dependencies.push(...filterDeps);
  }

  // 3. Auto Event Filter
  if (trigger.autoEventFilter) {
    const autoFilterDeps = extractFilterDependencies(trigger.autoEventFilter, 'autoEventFilter');
    dependencies.push(...autoFilterDeps);
  }

  // 4. Custom Event Filter
  if (trigger.customEventFilter) {
    const customFilterDeps = extractFilterDependencies(trigger.customEventFilter, 'customEventFilter');
    dependencies.push(...customFilterDeps);
  }

  return dependencies;
}

// ==================== Variable Parser ====================

/**
 * 변수에서 의존성 추출
 */
export function extractVariableDependencies(variable: GTMVariable): DependencyEdge[] {
  const dependencies: DependencyEdge[] = [];

  // 1. Parameters
  if (variable.parameter) {
    const paramDeps = extractParameterDependencies(variable.parameter, 'parameter');
    dependencies.push(...paramDeps);
  }

  // 2. JavaScript 변수 내부 참조 (jsm 타입)
  if (variable.type === 'jsm') {
    const jsCode = variable.parameter?.find(p => p.key === 'javascript')?.value;
    if (jsCode) {
      const jsDeps = extractJsInternalReferences(jsCode);
      dependencies.push(...jsDeps);
    }
  }

  // 3. Lookup Table (smm 타입)
  if (variable.type === 'smm') {
    const lookupDeps = extractLookupTableDependencies(variable);
    dependencies.push(...lookupDeps);
  }

  // 4. Regex Table (remm 타입)
  if (variable.type === 'remm') {
    const regexDeps = extractRegexTableDependencies(variable);
    dependencies.push(...regexDeps);
  }

  return dependencies;
}

// ==================== Helper Functions ====================

/**
 * Parameter 배열에서 변수 참조 추출
 */
function extractParameterDependencies(
  parameters: GTMParameter[],
  basePath: string
): DependencyEdge[] {
  const dependencies: DependencyEdge[] = [];

  for (const param of parameters) {
    const path = `${basePath}.${param.key}`;

    // value에서 {{variable}} 참조 추출
    if (param.value) {
      const varRefs = extractVariableReferences(param.value);
      for (const varName of varRefs) {
        dependencies.push({
          targetId: `name:${varName}`,
          targetType: EntityType.VARIABLE,
          dependencyType: DependencyType.DIRECT_REFERENCE,
          location: path,
          variableName: varName
        });
      }
    }

    // 중첩 list
    if (param.list) {
      const listDeps = extractParameterDependencies(param.list, `${path}.list`);
      dependencies.push(...listDeps);
    }

    // 중첩 map
    if (param.map) {
      const mapDeps = extractParameterDependencies(param.map, `${path}.map`);
      dependencies.push(...mapDeps);
    }
  }

  return dependencies;
}

/**
 * Filter 배열에서 변수 참조 추출
 */
function extractFilterDependencies(
  filters: GTMFilter[],
  basePath: string
): DependencyEdge[] {
  const dependencies: DependencyEdge[] = [];

  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    const path = `${basePath}[${i}]`;

    for (const param of filter.parameter) {
      if (param.value) {
        const varRefs = extractVariableReferences(param.value);
        for (const varName of varRefs) {
          dependencies.push({
            targetId: `name:${varName}`,
            targetType: EntityType.VARIABLE,
            dependencyType: DependencyType.TRIGGER_CONDITION,
            location: `${path}.${param.key}`,
            variableName: varName
          });
        }
      }
    }
  }

  return dependencies;
}

/**
 * 텍스트에서 {{variable}} 참조 추출
 */
function extractVariableReferences(text: string): string[] {
  const pattern = /\{\{([^}]+)\}\}/g;
  const matches: string[] = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const varName = match[1].trim();
    if (!matches.includes(varName)) {
      matches.push(varName);
    }
  }

  return matches;
}

/**
 * JavaScript 코드 내부에서 변수 참조 추출
 */
function extractJsInternalReferences(jsCode: string): DependencyEdge[] {
  const dependencies: DependencyEdge[] = [];

  // {{variable}} 패턴
  const varRefs = extractVariableReferences(jsCode);
  for (const varName of varRefs) {
    dependencies.push({
      targetId: `name:${varName}`,
      targetType: EntityType.VARIABLE,
      dependencyType: DependencyType.JS_INTERNAL_REF,
      location: 'javascript',
      variableName: varName,
      note: 'JS 변수 내부 참조'
    });
  }

  return dependencies;
}

/**
 * Lookup Table에서 의존성 추출
 */
function extractLookupTableDependencies(variable: GTMVariable): DependencyEdge[] {
  const dependencies: DependencyEdge[] = [];

  if (!variable.parameter) return dependencies;

  // input 변수
  const inputParam = variable.parameter.find(p => p.key === 'input');
  if (inputParam?.value) {
    const varRefs = extractVariableReferences(inputParam.value);
    for (const varName of varRefs) {
      dependencies.push({
        targetId: `name:${varName}`,
        targetType: EntityType.VARIABLE,
        dependencyType: DependencyType.LOOKUP_INPUT,
        location: 'parameter.input',
        variableName: varName
      });
    }
  }

  // map 내 output 값들
  const mapParam = variable.parameter.find(p => p.key === 'map');
  if (mapParam?.list) {
    for (const item of mapParam.list) {
      if (item.map) {
        const outputParam = item.map.find(m => m.key === 'value');
        if (outputParam?.value) {
          const varRefs = extractVariableReferences(outputParam.value);
          for (const varName of varRefs) {
            dependencies.push({
              targetId: `name:${varName}`,
              targetType: EntityType.VARIABLE,
              dependencyType: DependencyType.LOOKUP_OUTPUT,
              location: 'parameter.map.value',
              variableName: varName
            });
          }
        }
      }
    }
  }

  return dependencies;
}

/**
 * Regex Table에서 의존성 추출
 */
function extractRegexTableDependencies(variable: GTMVariable): DependencyEdge[] {
  const dependencies: DependencyEdge[] = [];

  if (!variable.parameter) return dependencies;

  // input 변수
  const inputParam = variable.parameter.find(p => p.key === 'input');
  if (inputParam?.value) {
    const varRefs = extractVariableReferences(inputParam.value);
    for (const varName of varRefs) {
      dependencies.push({
        targetId: `name:${varName}`,
        targetType: EntityType.VARIABLE,
        dependencyType: DependencyType.LOOKUP_INPUT,
        location: 'parameter.input',
        variableName: varName
      });
    }
  }

  return dependencies;
}

/**
 * 변수 타입 정보 반환
 */
export function getVariableTypeInfo(type: string): {
  name: string;
  icon: string;
  hasInternalRefs: boolean;
} {
  const typeMap: Record<string, { name: string; icon: string; hasInternalRefs: boolean }> = {
    'v': { name: 'Data Layer Variable', icon: 'v', hasInternalRefs: false },
    'jsm': { name: 'Custom JavaScript', icon: 'jsm', hasInternalRefs: true },
    'c': { name: 'Constant', icon: 'c', hasInternalRefs: false },
    'smm': { name: 'Lookup Table', icon: 'smm', hasInternalRefs: true },
    'remm': { name: 'Regex Table', icon: 'remm', hasInternalRefs: true },
    'd': { name: 'DOM Element', icon: 'd', hasInternalRefs: false },
    'k': { name: '1st Party Cookie', icon: 'k', hasInternalRefs: false },
    'u': { name: 'URL Variable', icon: 'u', hasInternalRefs: false },
    'aev': { name: 'Auto-Event Variable', icon: 'aev', hasInternalRefs: false },
    'gas': { name: 'Google Analytics Settings', icon: 'gas', hasInternalRefs: true }
  };

  return typeMap[type] || { name: type, icon: '?', hasInternalRefs: false };
}

// ==================== Event-based Reverse Tracking ====================

/**
 * CustomEvent 트리거에서 감지하는 이벤트 이름 추출
 */
export function extractCustomEventName(trigger: GTMTrigger): string | null {
  // customEvent 타입만 처리
  if (trigger.type !== 'customEvent') return null;

  // customEventFilter에서 event 조건 찾기
  if (trigger.customEventFilter) {
    for (const filter of trigger.customEventFilter) {
      const arg0 = filter.parameter.find(p => p.key === 'arg0');
      const arg1 = filter.parameter.find(p => p.key === 'arg1');

      // arg0이 {{_event}}이고 arg1이 이벤트명
      if (arg0?.value === '{{_event}}' && arg1?.value) {
        return arg1.value;
      }
    }
  }
  return null;
}

/**
 * HTML 태그 또는 Custom Template에서 dataLayer.push 이벤트 추출
 */
export function extractPushedEvents(tag: GTMTag): string[] {
  const events: string[] = [];

  // 1. HTML 태그 (html 타입)
  if (tag.type === 'html') {
    const htmlParam = tag.parameter?.find(p => p.key === 'html');
    if (htmlParam?.value) {
      events.push(...extractDataLayerPushEvents(htmlParam.value));
    }
  }

  // 2. Custom Template 태그 - 알려진 템플릿 이벤트 매핑 사용
  const templateEvents = extractTemplateEvents(tag);
  events.push(...templateEvents);

  // 중복 제거
  return [...new Set(events)];
}

/**
 * 코드에서 dataLayer.push({ event: "xxx" }) 패턴 추출
 */
function extractDataLayerPushEvents(code: string): string[] {
  const events: string[] = [];

  // 패턴 1: dataLayer.push({ event: "eventName" })
  // 패턴 2: dataLayer.push({ "event": "eventName" })
  // 패턴 3: dataLayer.push({ 'event': 'eventName' })
  // 패턴 4: 멀티라인 지원
  const pattern = /dataLayer\.push\s*\(\s*\{[^}]*["']?event["']?\s*:\s*["']([^"']+)["']/gi;

  let match;
  while ((match = pattern.exec(code)) !== null) {
    const eventName = match[1];
    // 변수 참조 {{...}} 제외 (동적 이벤트는 추적 불가)
    if (!eventName.includes('{{') && !events.includes(eventName)) {
      events.push(eventName);
    }
  }

  return events;
}
