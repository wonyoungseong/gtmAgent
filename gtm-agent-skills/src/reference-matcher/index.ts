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

import { GTMTag, GTMTrigger, GTMVariable, GTMParameter } from '../types/gtm';

// ==================== Types ====================

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

// ==================== Reference Matcher ====================

export class ReferenceMatcher {
  private tags: GTMTag[] = [];
  private triggers: GTMTrigger[] = [];
  private variables: GTMVariable[] = [];

  constructor(
    tags?: GTMTag[],
    triggers?: GTMTrigger[],
    variables?: GTMVariable[]
  ) {
    if (tags) this.tags = tags;
    if (triggers) this.triggers = triggers;
    if (variables) this.variables = variables;
  }

  /**
   * 엔티티 목록 설정
   */
  setEntities(
    tags: GTMTag[],
    triggers: GTMTrigger[],
    variables: GTMVariable[]
  ): void {
    this.tags = tags;
    this.triggers = triggers;
    this.variables = variables;
  }

  // ==================== Name-based Search ====================

  /**
   * 이름으로 태그 검색
   */
  searchTagsByName(
    query: string,
    options: SearchOptions = {}
  ): SearchResult<GTMTag>[] {
    const { topK = 10, threshold = 0, tagType } = options;
    const queryTokens = this.tokenize(query);

    return this.tags
      .filter(tag => !tagType || tag.type === tagType)
      .map(tag => {
        const { score, reasons } = this.calculateNameMatchScore(
          tag.name,
          query,
          queryTokens,
          this.getTagExtraText(tag)
        );
        return { entity: tag, score, matchReasons: reasons };
      })
      .filter(r => r.score > threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 이름으로 변수 검색
   */
  searchVariablesByName(
    query: string,
    options: SearchOptions = {}
  ): SearchResult<GTMVariable>[] {
    const { topK = 10, threshold = 0, variableType } = options;
    const queryTokens = this.tokenize(query);

    return this.variables
      .filter(v => !variableType || v.type === variableType)
      .map(variable => {
        const { score, reasons } = this.calculateNameMatchScore(
          variable.name,
          query,
          queryTokens
        );
        return { entity: variable, score, matchReasons: reasons };
      })
      .filter(r => r.score > threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 이름으로 트리거 검색
   */
  searchTriggersByName(
    query: string,
    options: SearchOptions = {}
  ): SearchResult<GTMTrigger>[] {
    const { topK = 10, threshold = 0 } = options;
    const queryTokens = this.tokenize(query);

    return this.triggers
      .map(trigger => {
        const { score, reasons } = this.calculateNameMatchScore(
          trigger.name,
          query,
          queryTokens
        );
        return { entity: trigger, score, matchReasons: reasons };
      })
      .filter(r => r.score > threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // ==================== Similarity-based Search ====================

  /**
   * 유사한 태그 찾기
   */
  findSimilarTags(
    reference: GTMTag,
    options: SimilarityOptions = {}
  ): SearchResult<GTMTag>[] {
    const {
      considerName = true,
      considerType = true,
      considerParameters = true,
      threshold = 0.5
    } = options;

    return this.tags
      .filter(tag => tag.tagId !== reference.tagId)
      .map(tag => {
        const { score, reasons } = this.calculateTagSimilarity(
          reference,
          tag,
          { considerName, considerType, considerParameters }
        );
        return { entity: tag, score, matchReasons: reasons };
      })
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 특정 타입의 태그 찾기 (GA4 이벤트 등)
   */
  findTagsByType(tagType: string): GTMTag[] {
    return this.tags.filter(tag => tag.type === tagType);
  }

  /**
   * GA4 이벤트 이름으로 태그 찾기
   */
  findGA4TagsByEventName(eventName: string): GTMTag[] {
    return this.tags.filter(tag => {
      if (tag.type !== 'gaawe') return false;

      const eventNameParam = tag.parameter?.find(p => p.key === 'eventName');
      if (!eventNameParam?.value) return false;

      return eventNameParam.value.toLowerCase().includes(eventName.toLowerCase());
    });
  }

  /**
   * 정확한 이름으로 찾기
   */
  findTagByExactName(name: string): GTMTag | undefined {
    return this.tags.find(t => t.name === name);
  }

  findVariableByExactName(name: string): GTMVariable | undefined {
    return this.variables.find(v => v.name === name);
  }

  findTriggerByExactName(name: string): GTMTrigger | undefined {
    return this.triggers.find(t => t.name === name);
  }

  // ==================== Private Methods ====================

  /**
   * 이름 매칭 점수 계산
   */
  private calculateNameMatchScore(
    name: string,
    query: string,
    queryTokens: string[],
    extraText?: string
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    const nameLower = name.toLowerCase();
    const queryLower = query.toLowerCase();

    // 1. 정확한 이름 매칭 (100점)
    if (nameLower === queryLower) {
      score += 100;
      reasons.push('exact match');
    }
    // 2. 이름에 검색어 포함 (50점)
    else if (nameLower.includes(queryLower)) {
      score += 50;
      reasons.push('contains query');
    }

    // 3. 토큰 매칭 (최대 30점)
    const nameTokens = this.tokenize(name);
    let matchedTokens = 0;

    for (const queryToken of queryTokens) {
      for (const nameToken of nameTokens) {
        if (nameToken.includes(queryToken) || queryToken.includes(nameToken)) {
          matchedTokens++;
          break;
        }
      }
    }

    if (matchedTokens > 0 && queryTokens.length > 0) {
      const tokenScore = (matchedTokens / queryTokens.length) * 30;
      score += tokenScore;
      reasons.push(`${matchedTokens}/${queryTokens.length} tokens`);
    }

    // 4. 추가 텍스트 매칭 (10점)
    if (extraText && extraText.toLowerCase().includes(queryLower)) {
      score += 10;
      reasons.push('extra text match');
    }

    return { score, reasons };
  }

  /**
   * 태그 유사도 계산
   */
  private calculateTagSimilarity(
    reference: GTMTag,
    target: GTMTag,
    options: { considerName: boolean; considerType: boolean; considerParameters: boolean }
  ): { score: number; reasons: string[] } {
    let totalWeight = 0;
    let totalScore = 0;
    const reasons: string[] = [];

    // 1. 타입 유사도 (40%)
    if (options.considerType) {
      totalWeight += 40;
      if (reference.type === target.type) {
        totalScore += 40;
        reasons.push('same type');
      }
    }

    // 2. 이름 유사도 (30%)
    if (options.considerName) {
      totalWeight += 30;
      const nameSimilarity = this.calculateStringSimilarity(reference.name, target.name);
      totalScore += nameSimilarity * 30;
      if (nameSimilarity > 0.5) {
        reasons.push(`name similarity: ${(nameSimilarity * 100).toFixed(0)}%`);
      }
    }

    // 3. 파라미터 유사도 (30%)
    if (options.considerParameters && reference.parameter && target.parameter) {
      totalWeight += 30;
      const paramSimilarity = this.calculateParameterSimilarity(
        reference.parameter,
        target.parameter
      );
      totalScore += paramSimilarity * 30;
      if (paramSimilarity > 0.5) {
        reasons.push(`param similarity: ${(paramSimilarity * 100).toFixed(0)}%`);
      }
    }

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return { score: finalScore, reasons };
  }

  /**
   * 문자열 유사도 (Jaccard similarity)
   */
  private calculateStringSimilarity(a: string, b: string): number {
    const tokensA = new Set(this.tokenize(a));
    const tokensB = new Set(this.tokenize(b));

    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * 파라미터 유사도
   */
  private calculateParameterSimilarity(
    paramsA: GTMParameter[],
    paramsB: GTMParameter[]
  ): number {
    const keysA = new Set(paramsA.map(p => p.key));
    const keysB = new Set(paramsB.map(p => p.key));

    const intersection = new Set([...keysA].filter(x => keysB.has(x)));
    const union = new Set([...keysA, ...keysB]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * 텍스트 토큰화
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s\-_\.]+/)
      .filter(token => token.length > 1);
  }

  /**
   * 태그에서 추가 검색 텍스트 추출
   */
  private getTagExtraText(tag: GTMTag): string {
    const parts: string[] = [];

    // 이벤트 이름
    const eventNameParam = tag.parameter?.find(p => p.key === 'eventName');
    if (eventNameParam?.value) {
      parts.push(eventNameParam.value);
    }

    // Notes
    if (tag.notes) {
      parts.push(tag.notes);
    }

    return parts.join(' ');
  }
}

// ==================== Utility Functions ====================

/**
 * 태그를 검색 가능한 텍스트로 변환
 */
export function tagToSearchableText(tag: GTMTag): string {
  const parts: string[] = [tag.name, tag.type];

  const eventNameParam = tag.parameter?.find(p => p.key === 'eventName');
  if (eventNameParam?.value) {
    parts.push(eventNameParam.value);
  }

  if (tag.notes) {
    parts.push(tag.notes);
  }

  return parts.join(' ');
}

/**
 * 유사도 기반 태그 그룹핑
 */
export function groupSimilarTags(
  tags: GTMTag[],
  threshold: number = 0.7
): Map<string, GTMTag[]> {
  const groups = new Map<string, GTMTag[]>();
  const assigned = new Set<string>();

  for (const tag of tags) {
    if (assigned.has(tag.tagId)) continue;

    const groupKey = tag.tagId;
    const group: GTMTag[] = [tag];
    assigned.add(tag.tagId);

    const matcher = new ReferenceMatcher([tag], [], []);
    matcher.setEntities(tags, [], []);

    const similar = matcher.findSimilarTags(tag, { threshold });

    for (const result of similar) {
      if (!assigned.has(result.entity.tagId)) {
        group.push(result.entity);
        assigned.add(result.entity.tagId);
      }
    }

    groups.set(groupKey, group);
  }

  return groups;
}
