/**
 * Known Event Pushers
 * 알려진 커스텀 템플릿의 이벤트 push 매핑
 *
 * 커스텀 템플릿은 sandboxed JavaScript로 코드 분석이 어려우므로
 * 알려진 템플릿만 명시적으로 매핑합니다.
 */

import { GTMTag } from '../types/gtm';

/**
 * 알려진 커스텀 템플릿이 push하는 이벤트 목록
 * key: 템플릿 타입 (cvt_xxx 형식)
 * value: 해당 템플릿이 push하는 이벤트 이름 배열
 */
export const KNOWN_TEMPLATE_EVENTS: Record<string, string[]> = {
  // Gtag API Get 템플릿 - gtagApiGet 이벤트 push
  'cvt_KDDGR': ['gtagApiGet'],

  // 추가 템플릿 매핑...
  // 예: 'cvt_XXXXX': ['customEvent1', 'customEvent2'],
};

/**
 * 커스텀 템플릿 태그에서 push하는 이벤트 추출
 */
export function extractTemplateEvents(tag: GTMTag): string[] {
  // cvt_ 접두사 (Custom Variable Template) 또는 다른 커스텀 템플릿 확인
  if (tag.type?.startsWith('cvt_')) {
    return KNOWN_TEMPLATE_EVENTS[tag.type] || [];
  }

  // 일부 템플릿은 templateId를 통해 식별될 수 있음
  if (tag.templateId) {
    // templateId에서 템플릿 타입 추출 시도
    // 예: "accounts/xxx/containers/xxx/workspaces/xxx/templates/123"
    // 현재는 type 기반 매핑만 사용
  }

  return [];
}

/**
 * 알려진 템플릿 이벤트 매핑 추가 (런타임)
 * 동적으로 새 템플릿 매핑을 추가할 때 사용
 */
export function addKnownTemplateEvents(templateType: string, events: string[]): void {
  KNOWN_TEMPLATE_EVENTS[templateType] = events;
}

/**
 * 모든 알려진 이벤트 이름 반환
 */
export function getAllKnownEvents(): string[] {
  const allEvents: string[] = [];
  for (const events of Object.values(KNOWN_TEMPLATE_EVENTS)) {
    allEvents.push(...events);
  }
  return [...new Set(allEvents)];
}
