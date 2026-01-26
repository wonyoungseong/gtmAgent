"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GTM_NAMING_TEMPLATES = exports.NamingParser = void 0;
exports.inferEntityTypeFromName = inferEntityTypeFromName;
class NamingParser {
    /**
     * 이름 목록에서 패턴 추출
     */
    extractPattern(names) {
        if (names.length === 0)
            return null;
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
    generateName(pattern, params) {
        const parts = [];
        for (const segment of pattern.segments) {
            if (segment.type === 'literal') {
                parts.push(segment.value);
            }
            else {
                const value = params[segment.value];
                if (value !== undefined) {
                    parts.push(value);
                }
                else {
                    parts.push(`{${segment.value}}`);
                }
            }
        }
        return parts.join(pattern.separator);
    }
    /**
     * 이름이 패턴에 맞는지 검증
     */
    validate(name, pattern) {
        const nameParts = name.split(pattern.separator);
        const patternParts = pattern.segments;
        if (nameParts.length !== patternParts.length) {
            return {
                valid: false,
                issues: [`Expected ${patternParts.length} segments, got ${nameParts.length}`],
                suggestedName: this.suggestCorrection(name, pattern)
            };
        }
        const issues = [];
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
    findBestPattern(name, patterns) {
        let bestPattern = null;
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
    extractPatternsByPrefix(names, prefixHints = []) {
        const groups = this.groupByPrefix(names, prefixHints);
        const patterns = new Map();
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
    extractVariables(name, pattern) {
        const parts = name.split(pattern.separator);
        if (parts.length !== pattern.segments.length)
            return null;
        const variables = {};
        for (let i = 0; i < pattern.segments.length; i++) {
            const segment = pattern.segments[i];
            if (segment.type === 'variable') {
                variables[segment.value] = parts[i];
            }
        }
        return variables;
    }
    // ==================== Private Methods ====================
    detectSeparator(names) {
        const candidates = [' - ', '_', ' | ', '.', ' > ', ' / ', ' : '];
        const scores = new Map();
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
        let bestSep = null;
        let bestScore = 0.5;
        for (const [sep, score] of scores) {
            if (score > bestScore) {
                bestScore = score;
                bestSep = sep;
            }
        }
        return bestSep;
    }
    analyzeSegments(names, separator) {
        const splitNames = names.map(n => n.split(separator));
        const maxSegments = Math.max(...splitNames.map(s => s.length));
        const segments = [];
        for (let i = 0; i < maxSegments; i++) {
            const valuesAtPosition = splitNames
                .filter(parts => parts.length > i)
                .map(parts => parts[i]);
            const uniqueValues = [...new Set(valuesAtPosition)];
            const totalCount = valuesAtPosition.length;
            if (uniqueValues.length === 1) {
                segments.push({ type: 'literal', value: uniqueValues[0] });
            }
            else if (uniqueValues.length <= 5 && uniqueValues.length < totalCount * 0.5) {
                segments.push({
                    type: 'variable',
                    value: this.inferVariableName(uniqueValues, i),
                    possibleValues: uniqueValues
                });
            }
            else {
                segments.push({
                    type: 'variable',
                    value: this.inferVariableName(uniqueValues, i),
                    possibleValues: uniqueValues.slice(0, 10)
                });
            }
        }
        return segments;
    }
    inferVariableName(values, position) {
        const sample = values[0]?.toLowerCase() || '';
        if (this.looksLikeEventName(sample))
            return 'event';
        if (['tag', 'variable', 'trigger', 'dlv', 'js', 'ce', 'cv'].includes(sample))
            return 'type';
        if (['ga4', 'ua', 'facebook', 'google', 'meta', 'gtag'].includes(sample))
            return 'platform';
        if (['click', 'view', 'submit', 'scroll', 'load', 'custom'].includes(sample))
            return 'action';
        if (['event', 'config', 'pageview', 'conversion'].includes(sample))
            return 'category';
        return `segment${position + 1}`;
    }
    looksLikeEventName(value) {
        const patterns = [
            /^[a-z]+_[a-z]+/,
            /purchase|checkout|cart|view|click|submit|login|signup|add_to|begin|complete/i
        ];
        return patterns.some(p => p.test(value));
    }
    extractSingleNamePattern(name) {
        const separator = this.detectSeparator([name]);
        if (separator) {
            const parts = name.split(separator);
            const segments = parts.map(part => ({
                type: 'literal',
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
    extractSimplePattern(names) {
        const prefix = this.findCommonPrefix(names);
        const suffix = this.findCommonSuffix(names);
        const segments = [];
        if (prefix)
            segments.push({ type: 'literal', value: prefix });
        segments.push({ type: 'variable', value: 'name' });
        if (suffix)
            segments.push({ type: 'literal', value: suffix });
        return { separator: '', segments, confidence: 0.4, examples: names.slice(0, 5) };
    }
    findCommonPrefix(strings) {
        if (strings.length === 0)
            return '';
        let prefix = strings[0];
        for (const str of strings.slice(1)) {
            while (!str.startsWith(prefix) && prefix.length > 0) {
                prefix = prefix.slice(0, -1);
            }
        }
        return prefix;
    }
    findCommonSuffix(strings) {
        if (strings.length === 0)
            return '';
        let suffix = strings[0];
        for (const str of strings.slice(1)) {
            while (!str.endsWith(suffix) && suffix.length > 0) {
                suffix = suffix.slice(1);
            }
        }
        return suffix;
    }
    calculateConfidence(names, separator, segments) {
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
                if (matches)
                    validCount++;
            }
        }
        return validCount / names.length;
    }
    suggestCorrection(name, pattern) {
        const parts = name.split(pattern.separator);
        const suggested = [];
        for (let i = 0; i < pattern.segments.length; i++) {
            const segment = pattern.segments[i];
            if (segment.type === 'literal') {
                suggested.push(segment.value);
            }
            else if (parts[i]) {
                suggested.push(parts[i]);
            }
            else {
                suggested.push(`{${segment.value}}`);
            }
        }
        return suggested.join(pattern.separator);
    }
    groupByPrefix(names, prefixHints) {
        const groups = new Map();
        for (const name of names) {
            let matched = false;
            for (const hint of prefixHints) {
                if (name.startsWith(hint)) {
                    if (!groups.has(hint))
                        groups.set(hint, []);
                    groups.get(hint).push(name);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // 첫 번째 세그먼트를 그룹 키로 사용
                const firstPart = name.split(/[\s\-_]/)[0];
                if (!groups.has(firstPart))
                    groups.set(firstPart, []);
                groups.get(firstPart).push(name);
            }
        }
        return groups;
    }
}
exports.NamingParser = NamingParser;
// ==================== Utility Functions ====================
/**
 * GTM 표준 명명 규칙 템플릿
 */
exports.GTM_NAMING_TEMPLATES = {
    TAG_GA4_EVENT: {
        separator: ' - ',
        segments: [
            { type: 'literal', value: 'GA4' },
            { type: 'literal', value: 'Event' },
            { type: 'variable', value: 'event' }
        ],
        confidence: 1.0,
        examples: ['GA4 - Event - purchase', 'GA4 - Event - add_to_cart']
    },
    TAG_GA4_CONFIG: {
        separator: ' - ',
        segments: [
            { type: 'literal', value: 'GA4' },
            { type: 'literal', value: 'Config' }
        ],
        confidence: 1.0,
        examples: ['GA4 - Config']
    },
    TRIGGER_CUSTOM_EVENT: {
        separator: ' - ',
        segments: [
            { type: 'literal', value: 'CE' },
            { type: 'variable', value: 'event' }
        ],
        confidence: 1.0,
        examples: ['CE - purchase', 'CE - add_to_cart']
    },
    TRIGGER_CLICK: {
        separator: ' - ',
        segments: [
            { type: 'literal', value: 'Click' },
            { type: 'variable', value: 'target' }
        ],
        confidence: 1.0,
        examples: ['Click - CTA Button', 'Click - Nav Menu']
    },
    VARIABLE_DLV: {
        separator: ' - ',
        segments: [
            { type: 'literal', value: 'DLV' },
            { type: 'variable', value: 'path' }
        ],
        confidence: 1.0,
        examples: ['DLV - ecommerce.items', 'DLV - user.id']
    },
    VARIABLE_JS: {
        separator: ' - ',
        segments: [
            { type: 'literal', value: 'JS' },
            { type: 'variable', value: 'name' }
        ],
        confidence: 1.0,
        examples: ['JS - Format Price', 'JS - Get User ID']
    },
    VARIABLE_CONST: {
        separator: ' - ',
        segments: [
            { type: 'literal', value: 'Const' },
            { type: 'variable', value: 'name' }
        ],
        confidence: 1.0,
        examples: ['Const - GA4 Measurement ID', 'Const - Debug Mode']
    }
};
/**
 * 이름에서 타입 추론
 */
function inferEntityTypeFromName(name) {
    const prefixMap = {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbmFtaW5nLXBhcnNlci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0JHOzs7QUF1YkgsMERBb0JDO0FBdmNELE1BQWEsWUFBWTtJQUN2Qjs7T0FFRztJQUNILGNBQWMsQ0FBQyxLQUFlO1FBQzVCLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDcEMsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFFRCxTQUFTO1FBQ1QsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDZixPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBRUQsVUFBVTtRQUNWLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXhELE9BQU87WUFDTCxTQUFTO1lBQ1QsUUFBUTtZQUNSLFVBQVUsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUM7WUFDaEUsUUFBUSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUM1QixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsWUFBWSxDQUNWLE9BQXNCLEVBQ3RCLE1BQThCO1FBRTlCLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztRQUUzQixLQUFLLE1BQU0sT0FBTyxJQUFJLE9BQU8sQ0FB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QXVCLENBQUMsSUFBWTtJQUNsRCxNQUFNLFNBQVMsR0FBMkI7UUFDeEMsS0FBSyxFQUFFLFNBQVM7UUFDaEIsSUFBSSxFQUFFLFFBQVE7UUFDZCxJQUFJLEVBQUUsY0FBYztRQUNwQixJQUFJLEVBQUUsc0JBQXNCO1FBQzVCLE9BQU8sRUFBRSxlQUFlO1FBQ3hCLEtBQUssRUFBRSxxQkFBcUI7UUFDNUIsSUFBSSxFQUFFLHFCQUFxQjtRQUMzQixPQUFPLEVBQUUsbUJBQW1CO1FBQzVCLFFBQVEsRUFBRSxpQkFBaUI7S0FDNUIsQ0FBQztJQUVGLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7UUFDdkQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDNUIsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBOYW1pbmcgUGFyc2VyIFNraWxsXHJcbiAqXHJcbiAqIEdUTSDsl5Tti7Dti7Ag66qF66qFIOq3nOy5mSDrtoTshJ0g67CPIOyggeyaqVxyXG4gKiAtIOq4sOyhtCDsnbTrpoTrk6Tsl5DshJwg7Yyo7YS0IOy2lOy2nFxyXG4gKiAtIO2MqO2EtOyXkCDrp57ripQg7IOIIOydtOumhCDsg53shLFcclxuICogLSDsnbTrpoQg6rKA7KadXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYHR5cGVzY3JpcHRcclxuICogY29uc3QgcGFyc2VyID0gbmV3IE5hbWluZ1BhcnNlcigpO1xyXG4gKlxyXG4gKiAvLyDtjKjthLQg7LaU7LacXHJcbiAqIGNvbnN0IHRhZ05hbWVzID0gWydHQTQgLSBFdmVudCAtIHB1cmNoYXNlJywgJ0dBNCAtIEV2ZW50IC0gYWRkX3RvX2NhcnQnXTtcclxuICogY29uc3QgcGF0dGVybiA9IHBhcnNlci5leHRyYWN0UGF0dGVybih0YWdOYW1lcyk7XHJcbiAqXHJcbiAqIC8vIOyDiCDsnbTrpoQg7IOd7ISxXHJcbiAqIGNvbnN0IG5ld05hbWUgPSBwYXJzZXIuZ2VuZXJhdGVOYW1lKHBhdHRlcm4sIHsgZXZlbnQ6ICdiZWdpbl9jaGVja291dCcgfSk7XHJcbiAqIC8vICdHQTQgLSBFdmVudCAtIGJlZ2luX2NoZWNrb3V0J1xyXG4gKiBgYGBcclxuICovXHJcblxyXG5pbXBvcnQgeyBOYW1pbmdQYXR0ZXJuLCBQYXR0ZXJuU2VnbWVudCwgTmFtaW5nVmFsaWRhdGlvbiB9IGZyb20gJy4uL3R5cGVzL2RlcGVuZGVuY3knO1xyXG5cclxuZXhwb3J0IGNsYXNzIE5hbWluZ1BhcnNlciB7XHJcbiAgLyoqXHJcbiAgICog7J2066aEIOuqqeuhneyXkOyEnCDtjKjthLQg7LaU7LacXHJcbiAgICovXHJcbiAgZXh0cmFjdFBhdHRlcm4obmFtZXM6IHN0cmluZ1tdKTogTmFtaW5nUGF0dGVybiB8IG51bGwge1xyXG4gICAgaWYgKG5hbWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XHJcbiAgICBpZiAobmFtZXMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmV4dHJhY3RTaW5nbGVOYW1lUGF0dGVybihuYW1lc1swXSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8g6rWs67aE7J6QIOqwkOyngFxyXG4gICAgY29uc3Qgc2VwYXJhdG9yID0gdGhpcy5kZXRlY3RTZXBhcmF0b3IobmFtZXMpO1xyXG4gICAgaWYgKCFzZXBhcmF0b3IpIHtcclxuICAgICAgcmV0dXJuIHRoaXMuZXh0cmFjdFNpbXBsZVBhdHRlcm4obmFtZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIOyEuOq3uOuovO2KuCDrtoTshJ1cclxuICAgIGNvbnN0IHNlZ21lbnRzID0gdGhpcy5hbmFseXplU2VnbWVudHMobmFtZXMsIHNlcGFyYXRvcik7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc2VwYXJhdG9yLFxyXG4gICAgICBzZWdtZW50cyxcclxuICAgICAgY29uZmlkZW5jZTogdGhpcy5jYWxjdWxhdGVDb25maWRlbmNlKG5hbWVzLCBzZXBhcmF0b3IsIHNlZ21lbnRzKSxcclxuICAgICAgZXhhbXBsZXM6IG5hbWVzLnNsaWNlKDAsIDUpXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7Yyo7YS07Jy866GcIOyDiCDsnbTrpoQg7IOd7ISxXHJcbiAgICovXHJcbiAgZ2VuZXJhdGVOYW1lKFxyXG4gICAgcGF0dGVybjogTmFtaW5nUGF0dGVybixcclxuICAgIHBhcmFtczogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxyXG4gICk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHNlZ21lbnQgb2YgcGF0dGVybi5zZWdtZW50cykge1xyXG4gICAgICBpZiAoc2VnbWVudC50eXBlID09PSAnbGl0ZXJhbCcpIHtcclxuICAgICAgICBwYXJ0cy5wdXNoKHNlZ21lbnQudmFsdWUpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IHZhbHVlID0gcGFyYW1zW3NlZ21lbnQudmFsdWVdO1xyXG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICBwYXJ0cy5wdXNoKHZhbHVlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcGFydHMucHVzaChgeyR7c2VnbWVudC52YWx1ZX19YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHBhcnRzLmpvaW4ocGF0dGVybi5zZXBhcmF0b3IpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7J2066aE7J20IO2MqO2EtOyXkCDrp57ripTsp4Ag6rKA7KadXHJcbiAgICovXHJcbiAgdmFsaWRhdGUobmFtZTogc3RyaW5nLCBwYXR0ZXJuOiBOYW1pbmdQYXR0ZXJuKTogTmFtaW5nVmFsaWRhdGlvbiB7XHJcbiAgICBjb25zdCBuYW1lUGFydHMgPSBuYW1lLnNwbGl0KHBhdHRlcm4uc2VwYXJhdG9yKTtcclxuICAgIGNvbnN0IHBhdHRlcm5QYXJ0cyA9IHBhdHRlcm4uc2VnbWVudHM7XHJcblxyXG4gICAgaWYgKG5hbWVQYXJ0cy5sZW5ndGggIT09IHBhdHRlcm5QYXJ0cy5sZW5ndGgpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICB2YWxpZDogZmFsc2UsXHJcbiAgICAgICAgaXNzdWVzOiBbYEV4cGVjdGVkICR7cGF0dGVyblBhcnRzLmxlbmd0aH0gc2VnbWVudHMsIGdvdCAke25hbWVQYXJ0cy5sZW5ndGh9YF0sXHJcbiAgICAgICAgc3VnZ2VzdGVkTmFtZTogdGhpcy5zdWdnZXN0Q29ycmVjdGlvbihuYW1lLCBwYXR0ZXJuKVxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGlzc3Vlczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdHRlcm5QYXJ0cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBjb25zdCBzZWdtZW50ID0gcGF0dGVyblBhcnRzW2ldO1xyXG4gICAgICBjb25zdCBwYXJ0ID0gbmFtZVBhcnRzW2ldO1xyXG5cclxuICAgICAgaWYgKHNlZ21lbnQudHlwZSA9PT0gJ2xpdGVyYWwnICYmIHBhcnQgIT09IHNlZ21lbnQudmFsdWUpIHtcclxuICAgICAgICBpc3N1ZXMucHVzaChgU2VnbWVudCAke2kgKyAxfTogRXhwZWN0ZWQgXCIke3NlZ21lbnQudmFsdWV9XCIsIGdvdCBcIiR7cGFydH1cImApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdmFsaWQ6IGlzc3Vlcy5sZW5ndGggPT09IDAsXHJcbiAgICAgIG1hdGNoZWRQYXR0ZXJuOiBwYXR0ZXJuLFxyXG4gICAgICBpc3N1ZXM6IGlzc3Vlcy5sZW5ndGggPiAwID8gaXNzdWVzIDogdW5kZWZpbmVkXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7Jes65+sIO2MqO2EtCDspJEg6rCA7J6lIOygge2Vqe2VnCDqsoMg7LC+6riwXHJcbiAgICovXHJcbiAgZmluZEJlc3RQYXR0ZXJuKG5hbWU6IHN0cmluZywgcGF0dGVybnM6IE5hbWluZ1BhdHRlcm5bXSk6IE5hbWluZ1BhdHRlcm4gfCBudWxsIHtcclxuICAgIGxldCBiZXN0UGF0dGVybjogTmFtaW5nUGF0dGVybiB8IG51bGwgPSBudWxsO1xyXG4gICAgbGV0IGJlc3RTY29yZSA9IDA7XHJcblxyXG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHBhdHRlcm5zKSB7XHJcbiAgICAgIGNvbnN0IHZhbGlkYXRpb24gPSB0aGlzLnZhbGlkYXRlKG5hbWUsIHBhdHRlcm4pO1xyXG4gICAgICBpZiAodmFsaWRhdGlvbi52YWxpZCAmJiBwYXR0ZXJuLmNvbmZpZGVuY2UgPiBiZXN0U2NvcmUpIHtcclxuICAgICAgICBiZXN0U2NvcmUgPSBwYXR0ZXJuLmNvbmZpZGVuY2U7XHJcbiAgICAgICAgYmVzdFBhdHRlcm4gPSBwYXR0ZXJuO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGJlc3RQYXR0ZXJuO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7JeU7Yuw7YuwIO2DgOyeheuzhCDtjKjthLQg7LaU7LacXHJcbiAgICovXHJcbiAgZXh0cmFjdFBhdHRlcm5zQnlQcmVmaXgoXHJcbiAgICBuYW1lczogc3RyaW5nW10sXHJcbiAgICBwcmVmaXhIaW50czogc3RyaW5nW10gPSBbXVxyXG4gICk6IE1hcDxzdHJpbmcsIE5hbWluZ1BhdHRlcm4+IHtcclxuICAgIGNvbnN0IGdyb3VwcyA9IHRoaXMuZ3JvdXBCeVByZWZpeChuYW1lcywgcHJlZml4SGludHMpO1xyXG4gICAgY29uc3QgcGF0dGVybnMgPSBuZXcgTWFwPHN0cmluZywgTmFtaW5nUGF0dGVybj4oKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IFtwcmVmaXgsIGdyb3VwTmFtZXNdIG9mIGdyb3Vwcykge1xyXG4gICAgICBjb25zdCBwYXR0ZXJuID0gdGhpcy5leHRyYWN0UGF0dGVybihncm91cE5hbWVzKTtcclxuICAgICAgaWYgKHBhdHRlcm4pIHtcclxuICAgICAgICBwYXR0ZXJucy5zZXQocHJlZml4LCBwYXR0ZXJuKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBwYXR0ZXJucztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOydtOumhOyXkOyEnCDrs4DsiJgg6rCS65OkIOy2lOy2nFxyXG4gICAqL1xyXG4gIGV4dHJhY3RWYXJpYWJsZXMobmFtZTogc3RyaW5nLCBwYXR0ZXJuOiBOYW1pbmdQYXR0ZXJuKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IG51bGwge1xyXG4gICAgY29uc3QgcGFydHMgPSBuYW1lLnNwbGl0KHBhdHRlcm4uc2VwYXJhdG9yKTtcclxuICAgIGlmIChwYXJ0cy5sZW5ndGggIT09IHBhdHRlcm4uc2VnbWVudHMubGVuZ3RoKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICBjb25zdCB2YXJpYWJsZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdHRlcm4uc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgY29uc3Qgc2VnbWVudCA9IHBhdHRlcm4uc2VnbWVudHNbaV07XHJcbiAgICAgIGlmIChzZWdtZW50LnR5cGUgPT09ICd2YXJpYWJsZScpIHtcclxuICAgICAgICB2YXJpYWJsZXNbc2VnbWVudC52YWx1ZV0gPSBwYXJ0c1tpXTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB2YXJpYWJsZXM7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBQcml2YXRlIE1ldGhvZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgcHJpdmF0ZSBkZXRlY3RTZXBhcmF0b3IobmFtZXM6IHN0cmluZ1tdKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBjYW5kaWRhdGVzID0gWycgLSAnLCAnXycsICcgfCAnLCAnLicsICcgPiAnLCAnIC8gJywgJyA6ICddO1xyXG4gICAgY29uc3Qgc2NvcmVzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHNlcCBvZiBjYW5kaWRhdGVzKSB7XHJcbiAgICAgIGxldCBjb3VudCA9IDA7XHJcbiAgICAgIGxldCBhdmdQYXJ0cyA9IDA7XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgbmFtZXMpIHtcclxuICAgICAgICBpZiAobmFtZS5pbmNsdWRlcyhzZXApKSB7XHJcbiAgICAgICAgICBjb3VudCsrO1xyXG4gICAgICAgICAgYXZnUGFydHMgKz0gbmFtZS5zcGxpdChzZXApLmxlbmd0aDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChjb3VudCA+IDApIHtcclxuICAgICAgICBhdmdQYXJ0cyAvPSBjb3VudDtcclxuICAgICAgICBjb25zdCB1c2FnZSA9IGNvdW50IC8gbmFtZXMubGVuZ3RoO1xyXG4gICAgICAgIGNvbnN0IHBhcnRTY29yZSA9IGF2Z1BhcnRzID49IDIgJiYgYXZnUGFydHMgPD0gNiA/IDEgOiAwLjU7XHJcbiAgICAgICAgc2NvcmVzLnNldChzZXAsIHVzYWdlICogcGFydFNjb3JlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGxldCBiZXN0U2VwOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICAgIGxldCBiZXN0U2NvcmUgPSAwLjU7XHJcblxyXG4gICAgZm9yIChjb25zdCBbc2VwLCBzY29yZV0gb2Ygc2NvcmVzKSB7XHJcbiAgICAgIGlmIChzY29yZSA+IGJlc3RTY29yZSkge1xyXG4gICAgICAgIGJlc3RTY29yZSA9IHNjb3JlO1xyXG4gICAgICAgIGJlc3RTZXAgPSBzZXA7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gYmVzdFNlcDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYW5hbHl6ZVNlZ21lbnRzKG5hbWVzOiBzdHJpbmdbXSwgc2VwYXJhdG9yOiBzdHJpbmcpOiBQYXR0ZXJuU2VnbWVudFtdIHtcclxuICAgIGNvbnN0IHNwbGl0TmFtZXMgPSBuYW1lcy5tYXAobiA9PiBuLnNwbGl0KHNlcGFyYXRvcikpO1xyXG4gICAgY29uc3QgbWF4U2VnbWVudHMgPSBNYXRoLm1heCguLi5zcGxpdE5hbWVzLm1hcChzID0+IHMubGVuZ3RoKSk7XHJcbiAgICBjb25zdCBzZWdtZW50czogUGF0dGVyblNlZ21lbnRbXSA9IFtdO1xyXG5cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4U2VnbWVudHM7IGkrKykge1xyXG4gICAgICBjb25zdCB2YWx1ZXNBdFBvc2l0aW9uID0gc3BsaXROYW1lc1xyXG4gICAgICAgIC5maWx0ZXIocGFydHMgPT4gcGFydHMubGVuZ3RoID4gaSlcclxuICAgICAgICAubWFwKHBhcnRzID0+IHBhcnRzW2ldKTtcclxuXHJcbiAgICAgIGNvbnN0IHVuaXF1ZVZhbHVlcyA9IFsuLi5uZXcgU2V0KHZhbHVlc0F0UG9zaXRpb24pXTtcclxuICAgICAgY29uc3QgdG90YWxDb3VudCA9IHZhbHVlc0F0UG9zaXRpb24ubGVuZ3RoO1xyXG5cclxuICAgICAgaWYgKHVuaXF1ZVZhbHVlcy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICBzZWdtZW50cy5wdXNoKHsgdHlwZTogJ2xpdGVyYWwnLCB2YWx1ZTogdW5pcXVlVmFsdWVzWzBdIH0pO1xyXG4gICAgICB9IGVsc2UgaWYgKHVuaXF1ZVZhbHVlcy5sZW5ndGggPD0gNSAmJiB1bmlxdWVWYWx1ZXMubGVuZ3RoIDwgdG90YWxDb3VudCAqIDAuNSkge1xyXG4gICAgICAgIHNlZ21lbnRzLnB1c2goe1xyXG4gICAgICAgICAgdHlwZTogJ3ZhcmlhYmxlJyxcclxuICAgICAgICAgIHZhbHVlOiB0aGlzLmluZmVyVmFyaWFibGVOYW1lKHVuaXF1ZVZhbHVlcywgaSksXHJcbiAgICAgICAgICBwb3NzaWJsZVZhbHVlczogdW5pcXVlVmFsdWVzXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2VnbWVudHMucHVzaCh7XHJcbiAgICAgICAgICB0eXBlOiAndmFyaWFibGUnLFxyXG4gICAgICAgICAgdmFsdWU6IHRoaXMuaW5mZXJWYXJpYWJsZU5hbWUodW5pcXVlVmFsdWVzLCBpKSxcclxuICAgICAgICAgIHBvc3NpYmxlVmFsdWVzOiB1bmlxdWVWYWx1ZXMuc2xpY2UoMCwgMTApXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gc2VnbWVudHM7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluZmVyVmFyaWFibGVOYW1lKHZhbHVlczogc3RyaW5nW10sIHBvc2l0aW9uOiBudW1iZXIpOiBzdHJpbmcge1xyXG4gICAgY29uc3Qgc2FtcGxlID0gdmFsdWVzWzBdPy50b0xvd2VyQ2FzZSgpIHx8ICcnO1xyXG5cclxuICAgIGlmICh0aGlzLmxvb2tzTGlrZUV2ZW50TmFtZShzYW1wbGUpKSByZXR1cm4gJ2V2ZW50JztcclxuICAgIGlmIChbJ3RhZycsICd2YXJpYWJsZScsICd0cmlnZ2VyJywgJ2RsdicsICdqcycsICdjZScsICdjdiddLmluY2x1ZGVzKHNhbXBsZSkpIHJldHVybiAndHlwZSc7XHJcbiAgICBpZiAoWydnYTQnLCAndWEnLCAnZmFjZWJvb2snLCAnZ29vZ2xlJywgJ21ldGEnLCAnZ3RhZyddLmluY2x1ZGVzKHNhbXBsZSkpIHJldHVybiAncGxhdGZvcm0nO1xyXG4gICAgaWYgKFsnY2xpY2snLCAndmlldycsICdzdWJtaXQnLCAnc2Nyb2xsJywgJ2xvYWQnLCAnY3VzdG9tJ10uaW5jbHVkZXMoc2FtcGxlKSkgcmV0dXJuICdhY3Rpb24nO1xyXG4gICAgaWYgKFsnZXZlbnQnLCAnY29uZmlnJywgJ3BhZ2V2aWV3JywgJ2NvbnZlcnNpb24nXS5pbmNsdWRlcyhzYW1wbGUpKSByZXR1cm4gJ2NhdGVnb3J5JztcclxuXHJcbiAgICByZXR1cm4gYHNlZ21lbnQke3Bvc2l0aW9uICsgMX1gO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsb29rc0xpa2VFdmVudE5hbWUodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgcGF0dGVybnMgPSBbXHJcbiAgICAgIC9eW2Etel0rX1thLXpdKy8sXHJcbiAgICAgIC9wdXJjaGFzZXxjaGVja291dHxjYXJ0fHZpZXd8Y2xpY2t8c3VibWl0fGxvZ2lufHNpZ251cHxhZGRfdG98YmVnaW58Y29tcGxldGUvaVxyXG4gICAgXTtcclxuICAgIHJldHVybiBwYXR0ZXJucy5zb21lKHAgPT4gcC50ZXN0KHZhbHVlKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGV4dHJhY3RTaW5nbGVOYW1lUGF0dGVybihuYW1lOiBzdHJpbmcpOiBOYW1pbmdQYXR0ZXJuIHtcclxuICAgIGNvbnN0IHNlcGFyYXRvciA9IHRoaXMuZGV0ZWN0U2VwYXJhdG9yKFtuYW1lXSk7XHJcblxyXG4gICAgaWYgKHNlcGFyYXRvcikge1xyXG4gICAgICBjb25zdCBwYXJ0cyA9IG5hbWUuc3BsaXQoc2VwYXJhdG9yKTtcclxuICAgICAgY29uc3Qgc2VnbWVudHM6IFBhdHRlcm5TZWdtZW50W10gPSBwYXJ0cy5tYXAocGFydCA9PiAoe1xyXG4gICAgICAgIHR5cGU6ICdsaXRlcmFsJyBhcyBjb25zdCxcclxuICAgICAgICB2YWx1ZTogcGFydFxyXG4gICAgICB9KSk7XHJcblxyXG4gICAgICByZXR1cm4geyBzZXBhcmF0b3IsIHNlZ21lbnRzLCBjb25maWRlbmNlOiAwLjUsIGV4YW1wbGVzOiBbbmFtZV0gfTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzZXBhcmF0b3I6ICcnLFxyXG4gICAgICBzZWdtZW50czogW3sgdHlwZTogJ2xpdGVyYWwnLCB2YWx1ZTogbmFtZSB9XSxcclxuICAgICAgY29uZmlkZW5jZTogMC4zLFxyXG4gICAgICBleGFtcGxlczogW25hbWVdXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBleHRyYWN0U2ltcGxlUGF0dGVybihuYW1lczogc3RyaW5nW10pOiBOYW1pbmdQYXR0ZXJuIHtcclxuICAgIGNvbnN0IHByZWZpeCA9IHRoaXMuZmluZENvbW1vblByZWZpeChuYW1lcyk7XHJcbiAgICBjb25zdCBzdWZmaXggPSB0aGlzLmZpbmRDb21tb25TdWZmaXgobmFtZXMpO1xyXG4gICAgY29uc3Qgc2VnbWVudHM6IFBhdHRlcm5TZWdtZW50W10gPSBbXTtcclxuXHJcbiAgICBpZiAocHJlZml4KSBzZWdtZW50cy5wdXNoKHsgdHlwZTogJ2xpdGVyYWwnLCB2YWx1ZTogcHJlZml4IH0pO1xyXG4gICAgc2VnbWVudHMucHVzaCh7IHR5cGU6ICd2YXJpYWJsZScsIHZhbHVlOiAnbmFtZScgfSk7XHJcbiAgICBpZiAoc3VmZml4KSBzZWdtZW50cy5wdXNoKHsgdHlwZTogJ2xpdGVyYWwnLCB2YWx1ZTogc3VmZml4IH0pO1xyXG5cclxuICAgIHJldHVybiB7IHNlcGFyYXRvcjogJycsIHNlZ21lbnRzLCBjb25maWRlbmNlOiAwLjQsIGV4YW1wbGVzOiBuYW1lcy5zbGljZSgwLCA1KSB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmaW5kQ29tbW9uUHJlZml4KHN0cmluZ3M6IHN0cmluZ1tdKTogc3RyaW5nIHtcclxuICAgIGlmIChzdHJpbmdzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICcnO1xyXG4gICAgbGV0IHByZWZpeCA9IHN0cmluZ3NbMF07XHJcbiAgICBmb3IgKGNvbnN0IHN0ciBvZiBzdHJpbmdzLnNsaWNlKDEpKSB7XHJcbiAgICAgIHdoaWxlICghc3RyLnN0YXJ0c1dpdGgocHJlZml4KSAmJiBwcmVmaXgubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHByZWZpeCA9IHByZWZpeC5zbGljZSgwLCAtMSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBwcmVmaXg7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZpbmRDb21tb25TdWZmaXgoc3RyaW5nczogc3RyaW5nW10pOiBzdHJpbmcge1xyXG4gICAgaWYgKHN0cmluZ3MubGVuZ3RoID09PSAwKSByZXR1cm4gJyc7XHJcbiAgICBsZXQgc3VmZml4ID0gc3RyaW5nc1swXTtcclxuICAgIGZvciAoY29uc3Qgc3RyIG9mIHN0cmluZ3Muc2xpY2UoMSkpIHtcclxuICAgICAgd2hpbGUgKCFzdHIuZW5kc1dpdGgoc3VmZml4KSAmJiBzdWZmaXgubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHN1ZmZpeCA9IHN1ZmZpeC5zbGljZSgxKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHN1ZmZpeDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2FsY3VsYXRlQ29uZmlkZW5jZShcclxuICAgIG5hbWVzOiBzdHJpbmdbXSxcclxuICAgIHNlcGFyYXRvcjogc3RyaW5nLFxyXG4gICAgc2VnbWVudHM6IFBhdHRlcm5TZWdtZW50W11cclxuICApOiBudW1iZXIge1xyXG4gICAgbGV0IHZhbGlkQ291bnQgPSAwO1xyXG5cclxuICAgIGZvciAoY29uc3QgbmFtZSBvZiBuYW1lcykge1xyXG4gICAgICBjb25zdCBwYXJ0cyA9IG5hbWUuc3BsaXQoc2VwYXJhdG9yKTtcclxuICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gc2VnbWVudHMubGVuZ3RoKSB7XHJcbiAgICAgICAgbGV0IG1hdGNoZXMgPSB0cnVlO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgIGlmIChzZWdtZW50c1tpXS50eXBlID09PSAnbGl0ZXJhbCcgJiYgcGFydHNbaV0gIT09IHNlZ21lbnRzW2ldLnZhbHVlKSB7XHJcbiAgICAgICAgICAgIG1hdGNoZXMgPSBmYWxzZTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChtYXRjaGVzKSB2YWxpZENvdW50Kys7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdmFsaWRDb3VudCAvIG5hbWVzLmxlbmd0aDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3VnZ2VzdENvcnJlY3Rpb24obmFtZTogc3RyaW5nLCBwYXR0ZXJuOiBOYW1pbmdQYXR0ZXJuKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHBhcnRzID0gbmFtZS5zcGxpdChwYXR0ZXJuLnNlcGFyYXRvcik7XHJcbiAgICBjb25zdCBzdWdnZXN0ZWQ6IHN0cmluZ1tdID0gW107XHJcblxyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLnNlZ21lbnRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnQgPSBwYXR0ZXJuLnNlZ21lbnRzW2ldO1xyXG4gICAgICBpZiAoc2VnbWVudC50eXBlID09PSAnbGl0ZXJhbCcpIHtcclxuICAgICAgICBzdWdnZXN0ZWQucHVzaChzZWdtZW50LnZhbHVlKTtcclxuICAgICAgfSBlbHNlIGlmIChwYXJ0c1tpXSkge1xyXG4gICAgICAgIHN1Z2dlc3RlZC5wdXNoKHBhcnRzW2ldKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzdWdnZXN0ZWQucHVzaChgeyR7c2VnbWVudC52YWx1ZX19YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gc3VnZ2VzdGVkLmpvaW4ocGF0dGVybi5zZXBhcmF0b3IpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBncm91cEJ5UHJlZml4KFxyXG4gICAgbmFtZXM6IHN0cmluZ1tdLFxyXG4gICAgcHJlZml4SGludHM6IHN0cmluZ1tdXHJcbiAgKTogTWFwPHN0cmluZywgc3RyaW5nW10+IHtcclxuICAgIGNvbnN0IGdyb3VwcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2YgbmFtZXMpIHtcclxuICAgICAgbGV0IG1hdGNoZWQgPSBmYWxzZTtcclxuXHJcbiAgICAgIGZvciAoY29uc3QgaGludCBvZiBwcmVmaXhIaW50cykge1xyXG4gICAgICAgIGlmIChuYW1lLnN0YXJ0c1dpdGgoaGludCkpIHtcclxuICAgICAgICAgIGlmICghZ3JvdXBzLmhhcyhoaW50KSkgZ3JvdXBzLnNldChoaW50LCBbXSk7XHJcbiAgICAgICAgICBncm91cHMuZ2V0KGhpbnQpIS5wdXNoKG5hbWUpO1xyXG4gICAgICAgICAgbWF0Y2hlZCA9IHRydWU7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICghbWF0Y2hlZCkge1xyXG4gICAgICAgIC8vIOyyqyDrsojsp7gg7IS46re466i87Yq466W8IOq3uOujuSDtgqTroZwg7IKs7JqpXHJcbiAgICAgICAgY29uc3QgZmlyc3RQYXJ0ID0gbmFtZS5zcGxpdCgvW1xcc1xcLV9dLylbMF07XHJcbiAgICAgICAgaWYgKCFncm91cHMuaGFzKGZpcnN0UGFydCkpIGdyb3Vwcy5zZXQoZmlyc3RQYXJ0LCBbXSk7XHJcbiAgICAgICAgZ3JvdXBzLmdldChmaXJzdFBhcnQpIS5wdXNoKG5hbWUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGdyb3VwcztcclxuICB9XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09IFV0aWxpdHkgRnVuY3Rpb25zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogR1RNIO2RnOykgCDrqoXrqoUg6rec7LmZIO2FnO2UjOumv1xyXG4gKi9cclxuZXhwb3J0IGNvbnN0IEdUTV9OQU1JTkdfVEVNUExBVEVTID0ge1xyXG4gIFRBR19HQTRfRVZFTlQ6IHtcclxuICAgIHNlcGFyYXRvcjogJyAtICcsXHJcbiAgICBzZWdtZW50czogW1xyXG4gICAgICB7IHR5cGU6ICdsaXRlcmFsJyBhcyBjb25zdCwgdmFsdWU6ICdHQTQnIH0sXHJcbiAgICAgIHsgdHlwZTogJ2xpdGVyYWwnIGFzIGNvbnN0LCB2YWx1ZTogJ0V2ZW50JyB9LFxyXG4gICAgICB7IHR5cGU6ICd2YXJpYWJsZScgYXMgY29uc3QsIHZhbHVlOiAnZXZlbnQnIH1cclxuICAgIF0sXHJcbiAgICBjb25maWRlbmNlOiAxLjAsXHJcbiAgICBleGFtcGxlczogWydHQTQgLSBFdmVudCAtIHB1cmNoYXNlJywgJ0dBNCAtIEV2ZW50IC0gYWRkX3RvX2NhcnQnXVxyXG4gIH0sXHJcbiAgVEFHX0dBNF9DT05GSUc6IHtcclxuICAgIHNlcGFyYXRvcjogJyAtICcsXHJcbiAgICBzZWdtZW50czogW1xyXG4gICAgICB7IHR5cGU6ICdsaXRlcmFsJyBhcyBjb25zdCwgdmFsdWU6ICdHQTQnIH0sXHJcbiAgICAgIHsgdHlwZTogJ2xpdGVyYWwnIGFzIGNvbnN0LCB2YWx1ZTogJ0NvbmZpZycgfVxyXG4gICAgXSxcclxuICAgIGNvbmZpZGVuY2U6IDEuMCxcclxuICAgIGV4YW1wbGVzOiBbJ0dBNCAtIENvbmZpZyddXHJcbiAgfSxcclxuICBUUklHR0VSX0NVU1RPTV9FVkVOVDoge1xyXG4gICAgc2VwYXJhdG9yOiAnIC0gJyxcclxuICAgIHNlZ21lbnRzOiBbXHJcbiAgICAgIHsgdHlwZTogJ2xpdGVyYWwnIGFzIGNvbnN0LCB2YWx1ZTogJ0NFJyB9LFxyXG4gICAgICB7IHR5cGU6ICd2YXJpYWJsZScgYXMgY29uc3QsIHZhbHVlOiAnZXZlbnQnIH1cclxuICAgIF0sXHJcbiAgICBjb25maWRlbmNlOiAxLjAsXHJcbiAgICBleGFtcGxlczogWydDRSAtIHB1cmNoYXNlJywgJ0NFIC0gYWRkX3RvX2NhcnQnXVxyXG4gIH0sXHJcbiAgVFJJR0dFUl9DTElDSzoge1xyXG4gICAgc2VwYXJhdG9yOiAnIC0gJyxcclxuICAgIHNlZ21lbnRzOiBbXHJcbiAgICAgIHsgdHlwZTogJ2xpdGVyYWwnIGFzIGNvbnN0LCB2YWx1ZTogJ0NsaWNrJyB9LFxyXG4gICAgICB7IHR5cGU6ICd2YXJpYWJsZScgYXMgY29uc3QsIHZhbHVlOiAndGFyZ2V0JyB9XHJcbiAgICBdLFxyXG4gICAgY29uZmlkZW5jZTogMS4wLFxyXG4gICAgZXhhbXBsZXM6IFsnQ2xpY2sgLSBDVEEgQnV0dG9uJywgJ0NsaWNrIC0gTmF2IE1lbnUnXVxyXG4gIH0sXHJcbiAgVkFSSUFCTEVfRExWOiB7XHJcbiAgICBzZXBhcmF0b3I6ICcgLSAnLFxyXG4gICAgc2VnbWVudHM6IFtcclxuICAgICAgeyB0eXBlOiAnbGl0ZXJhbCcgYXMgY29uc3QsIHZhbHVlOiAnRExWJyB9LFxyXG4gICAgICB7IHR5cGU6ICd2YXJpYWJsZScgYXMgY29uc3QsIHZhbHVlOiAncGF0aCcgfVxyXG4gICAgXSxcclxuICAgIGNvbmZpZGVuY2U6IDEuMCxcclxuICAgIGV4YW1wbGVzOiBbJ0RMViAtIGVjb21tZXJjZS5pdGVtcycsICdETFYgLSB1c2VyLmlkJ11cclxuICB9LFxyXG4gIFZBUklBQkxFX0pTOiB7XHJcbiAgICBzZXBhcmF0b3I6ICcgLSAnLFxyXG4gICAgc2VnbWVudHM6IFtcclxuICAgICAgeyB0eXBlOiAnbGl0ZXJhbCcgYXMgY29uc3QsIHZhbHVlOiAnSlMnIH0sXHJcbiAgICAgIHsgdHlwZTogJ3ZhcmlhYmxlJyBhcyBjb25zdCwgdmFsdWU6ICduYW1lJyB9XHJcbiAgICBdLFxyXG4gICAgY29uZmlkZW5jZTogMS4wLFxyXG4gICAgZXhhbXBsZXM6IFsnSlMgLSBGb3JtYXQgUHJpY2UnLCAnSlMgLSBHZXQgVXNlciBJRCddXHJcbiAgfSxcclxuICBWQVJJQUJMRV9DT05TVDoge1xyXG4gICAgc2VwYXJhdG9yOiAnIC0gJyxcclxuICAgIHNlZ21lbnRzOiBbXHJcbiAgICAgIHsgdHlwZTogJ2xpdGVyYWwnIGFzIGNvbnN0LCB2YWx1ZTogJ0NvbnN0JyB9LFxyXG4gICAgICB7IHR5cGU6ICd2YXJpYWJsZScgYXMgY29uc3QsIHZhbHVlOiAnbmFtZScgfVxyXG4gICAgXSxcclxuICAgIGNvbmZpZGVuY2U6IDEuMCxcclxuICAgIGV4YW1wbGVzOiBbJ0NvbnN0IC0gR0E0IE1lYXN1cmVtZW50IElEJywgJ0NvbnN0IC0gRGVidWcgTW9kZSddXHJcbiAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIOydtOumhOyXkOyEnCDtg4DsnoUg7LaU66GgXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJFbnRpdHlUeXBlRnJvbU5hbWUobmFtZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgY29uc3QgcHJlZml4TWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xyXG4gICAgJ0dBNCc6ICdnYTRfdGFnJyxcclxuICAgICdVQSc6ICd1YV90YWcnLFxyXG4gICAgJ0ZCJzogJ2ZhY2Vib29rX3RhZycsXHJcbiAgICAnQ0UnOiAnY3VzdG9tX2V2ZW50X3RyaWdnZXInLFxyXG4gICAgJ0NsaWNrJzogJ2NsaWNrX3RyaWdnZXInLFxyXG4gICAgJ0RMVic6ICdkYXRhX2xheWVyX3ZhcmlhYmxlJyxcclxuICAgICdKUyc6ICdqYXZhc2NyaXB0X3ZhcmlhYmxlJyxcclxuICAgICdDb25zdCc6ICdjb25zdGFudF92YXJpYWJsZScsXHJcbiAgICAnTG9va3VwJzogJ2xvb2t1cF92YXJpYWJsZSdcclxuICB9O1xyXG5cclxuICBmb3IgKGNvbnN0IFtwcmVmaXgsIHR5cGVdIG9mIE9iamVjdC5lbnRyaWVzKHByZWZpeE1hcCkpIHtcclxuICAgIGlmIChuYW1lLnN0YXJ0c1dpdGgocHJlZml4KSkge1xyXG4gICAgICByZXR1cm4gdHlwZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBudWxsO1xyXG59XHJcbiJdfQ==