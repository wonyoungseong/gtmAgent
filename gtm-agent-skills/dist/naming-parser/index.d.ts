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
import { NamingPattern, NamingValidation } from '../types/dependency';
export declare class NamingParser {
    /**
     * 이름 목록에서 패턴 추출
     */
    extractPattern(names: string[]): NamingPattern | null;
    /**
     * 패턴으로 새 이름 생성
     */
    generateName(pattern: NamingPattern, params: Record<string, string>): string;
    /**
     * 이름이 패턴에 맞는지 검증
     */
    validate(name: string, pattern: NamingPattern): NamingValidation;
    /**
     * 여러 패턴 중 가장 적합한 것 찾기
     */
    findBestPattern(name: string, patterns: NamingPattern[]): NamingPattern | null;
    /**
     * 엔티티 타입별 패턴 추출
     */
    extractPatternsByPrefix(names: string[], prefixHints?: string[]): Map<string, NamingPattern>;
    /**
     * 이름에서 변수 값들 추출
     */
    extractVariables(name: string, pattern: NamingPattern): Record<string, string> | null;
    private detectSeparator;
    private analyzeSegments;
    private inferVariableName;
    private looksLikeEventName;
    private extractSingleNamePattern;
    private extractSimplePattern;
    private findCommonPrefix;
    private findCommonSuffix;
    private calculateConfidence;
    private suggestCorrection;
    private groupByPrefix;
}
/**
 * GTM 표준 명명 규칙 템플릿
 */
export declare const GTM_NAMING_TEMPLATES: {
    TAG_GA4_EVENT: {
        separator: string;
        segments: ({
            type: "literal";
            value: string;
        } | {
            type: "variable";
            value: string;
        })[];
        confidence: number;
        examples: string[];
    };
    TAG_GA4_CONFIG: {
        separator: string;
        segments: {
            type: "literal";
            value: string;
        }[];
        confidence: number;
        examples: string[];
    };
    TRIGGER_CUSTOM_EVENT: {
        separator: string;
        segments: ({
            type: "literal";
            value: string;
        } | {
            type: "variable";
            value: string;
        })[];
        confidence: number;
        examples: string[];
    };
    TRIGGER_CLICK: {
        separator: string;
        segments: ({
            type: "literal";
            value: string;
        } | {
            type: "variable";
            value: string;
        })[];
        confidence: number;
        examples: string[];
    };
    VARIABLE_DLV: {
        separator: string;
        segments: ({
            type: "literal";
            value: string;
        } | {
            type: "variable";
            value: string;
        })[];
        confidence: number;
        examples: string[];
    };
    VARIABLE_JS: {
        separator: string;
        segments: ({
            type: "literal";
            value: string;
        } | {
            type: "variable";
            value: string;
        })[];
        confidence: number;
        examples: string[];
    };
    VARIABLE_CONST: {
        separator: string;
        segments: ({
            type: "literal";
            value: string;
        } | {
            type: "variable";
            value: string;
        })[];
        confidence: number;
        examples: string[];
    };
};
/**
 * 이름에서 타입 추론
 */
export declare function inferEntityTypeFromName(name: string): string | null;
