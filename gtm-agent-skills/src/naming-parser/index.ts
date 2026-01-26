/**
 * Naming Parser Skill
 *
 * GTM 엔티티 명명 규칙 분석 및 적용
 * - 기존 이름들에서 패턴 추출
 * - 패턴에 맞는 새 이름 생성
 * - 이름 검증
 *
 * @example
 * ```typescript
 * const parser = new NamingParser();
 *
 * // 패턴 추출
 * const tagNames = ['GA4 - Event - purchase', 'GA4 - Event - add_to_cart'];
 * const pattern = parser.extractPattern(tagNames);
 *
 * // 새 이름 생성
 * const newName = parser.generateName(pattern, { event: 'begin_checkout' });
 * // 'GA4 - Event - begin_checkout'
 * ```
 */

import { NamingPattern, PatternSegment, NamingValidation } from '../types/dependency';

export class NamingParser {
  /**
   * 이름 목록에서 패턴 추출
   */
  extractPattern(names: string[]): NamingPattern | null {
    if (names.length === 0) return null;
    if (names.length === 1) {
      return this.extractSingleNamePattern(names[0]);
    }

    // 구분자 감지
    const separator = this.detectSeparator(names);
    if (!separator) {
      return this.extractSimplePattern(names);
    }

    // 세그먼트 분석
    const segments = this.analyzeSegments(names, separator);

    return {
      separator,
      segments,
      confidence: this.calculateConfidence(names, separator, segments),
      examples: names.slice(0, 5)
    };
  }

  /**
   * 패턴으로 새 이름 생성
   */
  generateName(
    pattern: NamingPattern,
    params: Record<string, string>
  ): string {
    const parts: string[] = [];

    for (const segment of pattern.segments) {
      if (segment.type === 'literal') {
        parts.push(segment.value);
      } else {
        const value = params[segment.value];
        if (value !== undefined) {
          parts.push(value);
        } else {
          parts.push(`{${segment.value}}`);
        }
      }
    }

    return parts.join(pattern.separator);
  }

  /**
   * 이름이 패턴에 맞는지 검증
   */
  validate(name: string, pattern: NamingPattern): NamingValidation {
    const nameParts = name.split(pattern.separator);
    const patternParts = pattern.segments;

    if (nameParts.length !== patternParts.length) {
      return {
        valid: false,
        issues: [`Expected ${patternParts.length} segments, got ${nameParts.length}`],
        suggestedName: this.suggestCorrection(name, pattern)
      };
    }

    const issues: string[] = [];

    for (let i = 0; i < patternParts.length; i++) {
      const segment = patternParts[i];
      const part = nameParts[i];

      if (segment.type === 'literal' && part !== segment.value) {
        issues.push(`Segment ${i + 1}: Expected "${segment.value}", got "${part}"`);
      }
    }

    return {
      valid: issues.length === 0,
      matchedPattern: pattern,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  /**
   * 여러 패턴 중 가장 적합한 것 찾기
   */
  findBestPattern(name: string, patterns: NamingPattern[]): NamingPattern | null {
    let bestPattern: NamingPattern | null = null;
    let bestScore = 0;

    for (const pattern of patterns) {
      const validation = this.validate(name, pattern);
      if (validation.valid && pattern.confidence > bestScore) {
        bestScore = pattern.confidence;
        bestPattern = pattern;
      }
    }

    return bestPattern;
  }

  /**
   * 엔티티 타입별 패턴 추출
   */
  extractPatternsByPrefix(
    names: string[],
    prefixHints: string[] = []
  ): Map<string, NamingPattern> {
    const groups = this.groupByPrefix(names, prefixHints);
    const patterns = new Map<string, NamingPattern>();

    for (const [prefix, groupNames] of groups) {
      const pattern = this.extractPattern(groupNames);
      if (pattern) {
        patterns.set(prefix, pattern);
      }
    }

    return patterns;
  }

  /**
   * 이름에서 변수 값들 추출
   */
  extractVariables(name: string, pattern: NamingPattern): Record<string, string> | null {
    const parts = name.split(pattern.separator);
    if (parts.length !== pattern.segments.length) return null;

    const variables: Record<string, string> = {};

    for (let i = 0; i < pattern.segments.length; i++) {
      const segment = pattern.segments[i];
      if (segment.type === 'variable') {
        variables[segment.value] = parts[i];
      }
    }

    return variables;
  }

  // ==================== Private Methods ====================

  private detectSeparator(names: string[]): string | null {
    const candidates = [' - ', '_', ' | ', '.', ' > ', ' / ', ' : '];
    const scores = new Map<string, number>();

    for (const sep of candidates) {
      let count = 0;
      let avgParts = 0;

      for (const name of names) {
        if (name.includes(sep)) {
          count++;
          avgParts += name.split(sep).length;
        }
      }

      if (count > 0) {
        avgParts /= count;
        const usage = count / names.length;
        const partScore = avgParts >= 2 && avgParts <= 6 ? 1 : 0.5;
        scores.set(sep, usage * partScore);
      }
    }

    let bestSep: string | null = null;
    let bestScore = 0.5;

    for (const [sep, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestSep = sep;
      }
    }

    return bestSep;
  }

  private analyzeSegments(names: string[], separator: string): PatternSegment[] {
    const splitNames = names.map(n => n.split(separator));
    const maxSegments = Math.max(...splitNames.map(s => s.length));
    const segments: PatternSegment[] = [];

    for (let i = 0; i < maxSegments; i++) {
      const valuesAtPosition = splitNames
        .filter(parts => parts.length > i)
        .map(parts => parts[i]);

      const uniqueValues = [...new Set(valuesAtPosition)];
      const totalCount = valuesAtPosition.length;

      if (uniqueValues.length === 1) {
        segments.push({ type: 'literal', value: uniqueValues[0] });
      } else if (uniqueValues.length <= 5 && uniqueValues.length < totalCount * 0.5) {
        segments.push({
          type: 'variable',
          value: this.inferVariableName(uniqueValues, i),
          possibleValues: uniqueValues
        });
      } else {
        segments.push({
          type: 'variable',
          value: this.inferVariableName(uniqueValues, i),
          possibleValues: uniqueValues.slice(0, 10)
        });
      }
    }

    return segments;
  }

  private inferVariableName(values: string[], position: number): string {
    const sample = values[0]?.toLowerCase() || '';

    if (this.looksLikeEventName(sample)) return 'event';
    if (['tag', 'variable', 'trigger', 'dlv', 'js', 'ce', 'cv'].includes(sample)) return 'type';
    if (['ga4', 'ua', 'facebook', 'google', 'meta', 'gtag'].includes(sample)) return 'platform';
    if (['click', 'view', 'submit', 'scroll', 'load', 'custom'].includes(sample)) return 'action';
    if (['event', 'config', 'pageview', 'conversion'].includes(sample)) return 'category';

    return `segment${position + 1}`;
  }

  private looksLikeEventName(value: string): boolean {
    const patterns = [
      /^[a-z]+_[a-z]+/,
      /purchase|checkout|cart|view|click|submit|login|signup|add_to|begin|complete/i
    ];
    return patterns.some(p => p.test(value));
  }

  private extractSingleNamePattern(name: string): NamingPattern {
    const separator = this.detectSeparator([name]);

    if (separator) {
      const parts = name.split(separator);
      const segments: PatternSegment[] = parts.map(part => ({
        type: 'literal' as const,
        value: part
      }));

      return { separator, segments, confidence: 0.5, examples: [name] };
    }

    return {
      separator: '',
      segments: [{ type: 'literal', value: name }],
      confidence: 0.3,
      examples: [name]
    };
  }

  private extractSimplePattern(names: string[]): NamingPattern {
    const prefix = this.findCommonPrefix(names);
    const suffix = this.findCommonSuffix(names);
    const segments: PatternSegment[] = [];

    if (prefix) segments.push({ type: 'literal', value: prefix });
    segments.push({ type: 'variable', value: 'name' });
    if (suffix) segments.push({ type: 'literal', value: suffix });

    return { separator: '', segments, confidence: 0.4, examples: names.slice(0, 5) };
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    let prefix = strings[0];
    for (const str of strings.slice(1)) {
      while (!str.startsWith(prefix) && prefix.length > 0) {
        prefix = prefix.slice(0, -1);
      }
    }
    return prefix;
  }

  private findCommonSuffix(strings: string[]): string {
    if (strings.length === 0) return '';
    let suffix = strings[0];
    for (const str of strings.slice(1)) {
      while (!str.endsWith(suffix) && suffix.length > 0) {
        suffix = suffix.slice(1);
      }
    }
    return suffix;
  }

  private calculateConfidence(
    names: string[],
    separator: string,
    segments: PatternSegment[]
  ): number {
    let validCount = 0;

    for (const name of names) {
      const parts = name.split(separator);
      if (parts.length === segments.length) {
        let matches = true;
        for (let i = 0; i < segments.length; i++) {
          if (segments[i].type === 'literal' && parts[i] !== segments[i].value) {
            matches = false;
            break;
          }
        }
        if (matches) validCount++;
      }
    }

    return validCount / names.length;
  }

  private suggestCorrection(name: string, pattern: NamingPattern): string {
    const parts = name.split(pattern.separator);
    const suggested: string[] = [];

    for (let i = 0; i < pattern.segments.length; i++) {
      const segment = pattern.segments[i];
      if (segment.type === 'literal') {
        suggested.push(segment.value);
      } else if (parts[i]) {
        suggested.push(parts[i]);
      } else {
        suggested.push(`{${segment.value}}`);
      }
    }

    return suggested.join(pattern.separator);
  }

  private groupByPrefix(
    names: string[],
    prefixHints: string[]
  ): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const name of names) {
      let matched = false;

      for (const hint of prefixHints) {
        if (name.startsWith(hint)) {
          if (!groups.has(hint)) groups.set(hint, []);
          groups.get(hint)!.push(name);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // 첫 번째 세그먼트를 그룹 키로 사용
        const firstPart = name.split(/[\s\-_]/)[0];
        if (!groups.has(firstPart)) groups.set(firstPart, []);
        groups.get(firstPart)!.push(name);
      }
    }

    return groups;
  }
}

// ==================== Utility Functions ====================

/**
 * GTM 표준 명명 규칙 템플릿
 */
export const GTM_NAMING_TEMPLATES = {
  TAG_GA4_EVENT: {
    separator: ' - ',
    segments: [
      { type: 'literal' as const, value: 'GA4' },
      { type: 'literal' as const, value: 'Event' },
      { type: 'variable' as const, value: 'event' }
    ],
    confidence: 1.0,
    examples: ['GA4 - Event - purchase', 'GA4 - Event - add_to_cart']
  },
  TAG_GA4_CONFIG: {
    separator: ' - ',
    segments: [
      { type: 'literal' as const, value: 'GA4' },
      { type: 'literal' as const, value: 'Config' }
    ],
    confidence: 1.0,
    examples: ['GA4 - Config']
  },
  TRIGGER_CUSTOM_EVENT: {
    separator: ' - ',
    segments: [
      { type: 'literal' as const, value: 'CE' },
      { type: 'variable' as const, value: 'event' }
    ],
    confidence: 1.0,
    examples: ['CE - purchase', 'CE - add_to_cart']
  },
  TRIGGER_CLICK: {
    separator: ' - ',
    segments: [
      { type: 'literal' as const, value: 'Click' },
      { type: 'variable' as const, value: 'target' }
    ],
    confidence: 1.0,
    examples: ['Click - CTA Button', 'Click - Nav Menu']
  },
  VARIABLE_DLV: {
    separator: ' - ',
    segments: [
      { type: 'literal' as const, value: 'DLV' },
      { type: 'variable' as const, value: 'path' }
    ],
    confidence: 1.0,
    examples: ['DLV - ecommerce.items', 'DLV - user.id']
  },
  VARIABLE_JS: {
    separator: ' - ',
    segments: [
      { type: 'literal' as const, value: 'JS' },
      { type: 'variable' as const, value: 'name' }
    ],
    confidence: 1.0,
    examples: ['JS - Format Price', 'JS - Get User ID']
  },
  VARIABLE_CONST: {
    separator: ' - ',
    segments: [
      { type: 'literal' as const, value: 'Const' },
      { type: 'variable' as const, value: 'name' }
    ],
    confidence: 1.0,
    examples: ['Const - GA4 Measurement ID', 'Const - Debug Mode']
  }
};

/**
 * 이름에서 타입 추론
 */
export function inferEntityTypeFromName(name: string): string | null {
  const prefixMap: Record<string, string> = {
    'GA4': 'ga4_tag',
    'UA': 'ua_tag',
    'FB': 'facebook_tag',
    'CE': 'custom_event_trigger',
    'Click': 'click_trigger',
    'DLV': 'data_layer_variable',
    'JS': 'javascript_variable',
    'Const': 'constant_variable',
    'Lookup': 'lookup_variable'
  };

  for (const [prefix, type] of Object.entries(prefixMap)) {
    if (name.startsWith(prefix)) {
      return type;
    }
  }

  return null;
}
