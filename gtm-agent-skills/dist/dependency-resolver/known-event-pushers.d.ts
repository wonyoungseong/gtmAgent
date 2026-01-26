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
export declare const KNOWN_TEMPLATE_EVENTS: Record<string, string[]>;
/**
 * 커스텀 템플릿 태그에서 push하는 이벤트 추출
 */
export declare function extractTemplateEvents(tag: GTMTag): string[];
/**
 * 알려진 템플릿 이벤트 매핑 추가 (런타임)
 * 동적으로 새 템플릿 매핑을 추가할 때 사용
 */
export declare function addKnownTemplateEvents(templateType: string, events: string[]): void;
/**
 * 모든 알려진 이벤트 이름 반환
 */
export declare function getAllKnownEvents(): string[];
