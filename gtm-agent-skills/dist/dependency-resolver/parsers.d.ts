/**
 * GTM Entity Parsers
 * 태그/트리거/변수에서 의존성 참조 추출
 */
import { GTMTag, GTMTrigger, GTMVariable } from '../types/gtm';
import { DependencyEdge } from '../types/dependency';
/**
 * 태그에서 의존성 추출
 */
export declare function extractTagDependencies(tag: GTMTag): DependencyEdge[];
/**
 * 트리거에서 의존성 추출
 */
export declare function extractTriggerDependencies(trigger: GTMTrigger): DependencyEdge[];
/**
 * 변수에서 의존성 추출
 */
export declare function extractVariableDependencies(variable: GTMVariable): DependencyEdge[];
/**
 * 변수 타입 정보 반환
 */
export declare function getVariableTypeInfo(type: string): {
    name: string;
    icon: string;
    hasInternalRefs: boolean;
};
/**
 * CustomEvent 트리거에서 감지하는 이벤트 이름 추출
 */
export declare function extractCustomEventName(trigger: GTMTrigger): string | null;
/**
 * HTML 태그 또는 Custom Template에서 dataLayer.push 이벤트 추출
 */
export declare function extractPushedEvents(tag: GTMTag): string[];
