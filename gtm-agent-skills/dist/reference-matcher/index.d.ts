/**
 * Reference Matcher Skill
 *
 * GTM 엔티티 검색 및 유사도 계산
 * - 이름 기반 검색
 * - 타입/설정 기반 유사도 계산
 * - 유사 태그 추천
 *
 * @example
 * ```typescript
 * const matcher = new ReferenceMatcher(allTags, allVariables);
 *
 * // 이름으로 검색
 * const results = matcher.searchByName('purchase', { topK: 5 });
 *
 * // 유사 태그 찾기
 * const similar = matcher.findSimilarTags(referenceTag, { threshold: 0.7 });
 * ```
 */
import { GTMTag, GTMTrigger, GTMVariable } from '../types/gtm';
export interface SearchResult<T> {
    entity: T;
    score: number;
    matchReasons: string[];
}
export interface SearchOptions {
    topK?: number;
    threshold?: number;
    tagType?: string;
    variableType?: string;
}
export interface SimilarityOptions {
    considerName?: boolean;
    considerType?: boolean;
    considerParameters?: boolean;
    threshold?: number;
}
export declare class ReferenceMatcher {
    private tags;
    private triggers;
    private variables;
    constructor(tags?: GTMTag[], triggers?: GTMTrigger[], variables?: GTMVariable[]);
    /**
     * 엔티티 목록 설정
     */
    setEntities(tags: GTMTag[], triggers: GTMTrigger[], variables: GTMVariable[]): void;
    /**
     * 이름으로 태그 검색
     */
    searchTagsByName(query: string, options?: SearchOptions): SearchResult<GTMTag>[];
    /**
     * 이름으로 변수 검색
     */
    searchVariablesByName(query: string, options?: SearchOptions): SearchResult<GTMVariable>[];
    /**
     * 이름으로 트리거 검색
     */
    searchTriggersByName(query: string, options?: SearchOptions): SearchResult<GTMTrigger>[];
    /**
     * 유사한 태그 찾기
     */
    findSimilarTags(reference: GTMTag, options?: SimilarityOptions): SearchResult<GTMTag>[];
    /**
     * 특정 타입의 태그 찾기 (GA4 이벤트 등)
     */
    findTagsByType(tagType: string): GTMTag[];
    /**
     * GA4 이벤트 이름으로 태그 찾기
     */
    findGA4TagsByEventName(eventName: string): GTMTag[];
    /**
     * 정확한 이름으로 찾기
     */
    findTagByExactName(name: string): GTMTag | undefined;
    findVariableByExactName(name: string): GTMVariable | undefined;
    findTriggerByExactName(name: string): GTMTrigger | undefined;
    /**
     * 이름 매칭 점수 계산
     */
    private calculateNameMatchScore;
    /**
     * 태그 유사도 계산
     */
    private calculateTagSimilarity;
    /**
     * 문자열 유사도 (Jaccard similarity)
     */
    private calculateStringSimilarity;
    /**
     * 파라미터 유사도
     */
    private calculateParameterSimilarity;
    /**
     * 텍스트 토큰화
     */
    private tokenize;
    /**
     * 태그에서 추가 검색 텍스트 추출
     */
    private getTagExtraText;
}
/**
 * 태그를 검색 가능한 텍스트로 변환
 */
export declare function tagToSearchableText(tag: GTMTag): string;
/**
 * 유사도 기반 태그 그룹핑
 */
export declare function groupSimilarTags(tags: GTMTag[], threshold?: number): Map<string, GTMTag[]>;
