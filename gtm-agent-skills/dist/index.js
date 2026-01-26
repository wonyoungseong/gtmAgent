"use strict";
/**
 * GTM Agent Skills
 *
 * GTM Multi-Agent System을 위한 결정적 로직 모듈
 *
 * Skills는 Token을 소비하지 않는 코드 기반 로직입니다.
 * Agent가 판단이 필요할 때 호출하여 사용합니다.
 *
 * @example
 * ```typescript
 * import {
 *   DependencyGraphBuilder,
 *   IdMapper,
 *   ConfigTransformer,
 *   ReferenceMatcher,
 *   NamingParser,
 *   ValidationChecker
 * } from 'gtm-agent-skills';
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatValidationReport = exports.ValidationChecker = exports.inferEntityTypeFromName = exports.GTM_NAMING_TEMPLATES = exports.NamingParser = exports.groupSimilarTags = exports.tagToSearchableText = exports.ReferenceMatcher = exports.compareConfigs = exports.extractCreateConfig = exports.ConfigTransformer = exports.clearAllSessionMappers = exports.clearSessionMapper = exports.getSessionMapper = exports.IdMapper = exports.DependencyType = exports.KNOWN_TEMPLATE_EVENTS = exports.getAllKnownEvents = exports.addKnownTemplateEvents = exports.extractTemplateEvents = exports.extractPushedEvents = exports.extractCustomEventName = exports.getVariableTypeInfo = exports.extractVariableDependencies = exports.extractTriggerDependencies = exports.extractTagDependencies = exports.DependencyGraphBuilder = void 0;
// ==================== Types ====================
__exportStar(require("./types"), exports);
// ==================== Skills ====================
// Dependency Resolver - 의존성 분석 및 생성 순서 결정
var dependency_resolver_1 = require("./dependency-resolver");
Object.defineProperty(exports, "DependencyGraphBuilder", { enumerable: true, get: function () { return dependency_resolver_1.DependencyGraphBuilder; } });
Object.defineProperty(exports, "extractTagDependencies", { enumerable: true, get: function () { return dependency_resolver_1.extractTagDependencies; } });
Object.defineProperty(exports, "extractTriggerDependencies", { enumerable: true, get: function () { return dependency_resolver_1.extractTriggerDependencies; } });
Object.defineProperty(exports, "extractVariableDependencies", { enumerable: true, get: function () { return dependency_resolver_1.extractVariableDependencies; } });
Object.defineProperty(exports, "getVariableTypeInfo", { enumerable: true, get: function () { return dependency_resolver_1.getVariableTypeInfo; } });
Object.defineProperty(exports, "extractCustomEventName", { enumerable: true, get: function () { return dependency_resolver_1.extractCustomEventName; } });
Object.defineProperty(exports, "extractPushedEvents", { enumerable: true, get: function () { return dependency_resolver_1.extractPushedEvents; } });
Object.defineProperty(exports, "extractTemplateEvents", { enumerable: true, get: function () { return dependency_resolver_1.extractTemplateEvents; } });
Object.defineProperty(exports, "addKnownTemplateEvents", { enumerable: true, get: function () { return dependency_resolver_1.addKnownTemplateEvents; } });
Object.defineProperty(exports, "getAllKnownEvents", { enumerable: true, get: function () { return dependency_resolver_1.getAllKnownEvents; } });
Object.defineProperty(exports, "KNOWN_TEMPLATE_EVENTS", { enumerable: true, get: function () { return dependency_resolver_1.KNOWN_TEMPLATE_EVENTS; } });
Object.defineProperty(exports, "DependencyType", { enumerable: true, get: function () { return dependency_resolver_1.DependencyType; } });
// ID Mapper - Source/Target ID 매핑 관리
var id_mapper_1 = require("./id-mapper");
Object.defineProperty(exports, "IdMapper", { enumerable: true, get: function () { return id_mapper_1.IdMapper; } });
Object.defineProperty(exports, "getSessionMapper", { enumerable: true, get: function () { return id_mapper_1.getSessionMapper; } });
Object.defineProperty(exports, "clearSessionMapper", { enumerable: true, get: function () { return id_mapper_1.clearSessionMapper; } });
Object.defineProperty(exports, "clearAllSessionMappers", { enumerable: true, get: function () { return id_mapper_1.clearAllSessionMappers; } });
// Config Transformer - 엔티티 Config 변환
var config_transformer_1 = require("./config-transformer");
Object.defineProperty(exports, "ConfigTransformer", { enumerable: true, get: function () { return config_transformer_1.ConfigTransformer; } });
Object.defineProperty(exports, "extractCreateConfig", { enumerable: true, get: function () { return config_transformer_1.extractCreateConfig; } });
Object.defineProperty(exports, "compareConfigs", { enumerable: true, get: function () { return config_transformer_1.compareConfigs; } });
// Reference Matcher - 유사 엔티티 검색
var reference_matcher_1 = require("./reference-matcher");
Object.defineProperty(exports, "ReferenceMatcher", { enumerable: true, get: function () { return reference_matcher_1.ReferenceMatcher; } });
Object.defineProperty(exports, "tagToSearchableText", { enumerable: true, get: function () { return reference_matcher_1.tagToSearchableText; } });
Object.defineProperty(exports, "groupSimilarTags", { enumerable: true, get: function () { return reference_matcher_1.groupSimilarTags; } });
// Naming Parser - 명명 규칙 분석 및 적용
var naming_parser_1 = require("./naming-parser");
Object.defineProperty(exports, "NamingParser", { enumerable: true, get: function () { return naming_parser_1.NamingParser; } });
Object.defineProperty(exports, "GTM_NAMING_TEMPLATES", { enumerable: true, get: function () { return naming_parser_1.GTM_NAMING_TEMPLATES; } });
Object.defineProperty(exports, "inferEntityTypeFromName", { enumerable: true, get: function () { return naming_parser_1.inferEntityTypeFromName; } });
// Validation Checker - 생성 결과 검증
var validation_checker_1 = require("./validation-checker");
Object.defineProperty(exports, "ValidationChecker", { enumerable: true, get: function () { return validation_checker_1.ValidationChecker; } });
Object.defineProperty(exports, "formatValidationReport", { enumerable: true, get: function () { return validation_checker_1.formatValidationReport; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJHOzs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGtEQUFrRDtBQUNsRCwwQ0FBd0I7QUFFeEIsbURBQW1EO0FBRW5ELDBDQUEwQztBQUMxQyw2REFhK0I7QUFaN0IsNkhBQUEsc0JBQXNCLE9BQUE7QUFDdEIsNkhBQUEsc0JBQXNCLE9BQUE7QUFDdEIsaUlBQUEsMEJBQTBCLE9BQUE7QUFDMUIsa0lBQUEsMkJBQTJCLE9BQUE7QUFDM0IsMEhBQUEsbUJBQW1CLE9BQUE7QUFDbkIsNkhBQUEsc0JBQXNCLE9BQUE7QUFDdEIsMEhBQUEsbUJBQW1CLE9BQUE7QUFDbkIsNEhBQUEscUJBQXFCLE9BQUE7QUFDckIsNkhBQUEsc0JBQXNCLE9BQUE7QUFDdEIsd0hBQUEsaUJBQWlCLE9BQUE7QUFDakIsNEhBQUEscUJBQXFCLE9BQUE7QUFDckIscUhBQUEsY0FBYyxPQUFBO0FBSWhCLHFDQUFxQztBQUNyQyx5Q0FLcUI7QUFKbkIscUdBQUEsUUFBUSxPQUFBO0FBQ1IsNkdBQUEsZ0JBQWdCLE9BQUE7QUFDaEIsK0dBQUEsa0JBQWtCLE9BQUE7QUFDbEIsbUhBQUEsc0JBQXNCLE9BQUE7QUFHeEIscUNBQXFDO0FBQ3JDLDJEQUk4QjtBQUg1Qix1SEFBQSxpQkFBaUIsT0FBQTtBQUNqQix5SEFBQSxtQkFBbUIsT0FBQTtBQUNuQixvSEFBQSxjQUFjLE9BQUE7QUFJaEIsZ0NBQWdDO0FBQ2hDLHlEQUk2QjtBQUgzQixxSEFBQSxnQkFBZ0IsT0FBQTtBQUNoQix3SEFBQSxtQkFBbUIsT0FBQTtBQUNuQixxSEFBQSxnQkFBZ0IsT0FBQTtBQUlsQixnQ0FBZ0M7QUFDaEMsaURBSXlCO0FBSHZCLDZHQUFBLFlBQVksT0FBQTtBQUNaLHFIQUFBLG9CQUFvQixPQUFBO0FBQ3BCLHdIQUFBLHVCQUF1QixPQUFBO0FBR3pCLGdDQUFnQztBQUNoQywyREFHOEI7QUFGNUIsdUhBQUEsaUJBQWlCLE9BQUE7QUFDakIsNEhBQUEsc0JBQXNCLE9BQUEiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogR1RNIEFnZW50IFNraWxsc1xyXG4gKlxyXG4gKiBHVE0gTXVsdGktQWdlbnQgU3lzdGVt7J2EIOychO2VnCDqsrDsoJXsoIEg66Gc7KeBIOuqqOuTiFxyXG4gKlxyXG4gKiBTa2lsbHPripQgVG9rZW7snYQg7IaM67mE7ZWY7KeAIOyViuuKlCDsvZTrk5wg6riw67CYIOuhnOyngeyeheuLiOuLpC5cclxuICogQWdlbnTqsIAg7YyQ64uo7J20IO2VhOyalO2VoCDrlYwg7Zi47Lac7ZWY7JesIOyCrOyaqe2VqeuLiOuLpC5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBgdHlwZXNjcmlwdFxyXG4gKiBpbXBvcnQge1xyXG4gKiAgIERlcGVuZGVuY3lHcmFwaEJ1aWxkZXIsXHJcbiAqICAgSWRNYXBwZXIsXHJcbiAqICAgQ29uZmlnVHJhbnNmb3JtZXIsXHJcbiAqICAgUmVmZXJlbmNlTWF0Y2hlcixcclxuICogICBOYW1pbmdQYXJzZXIsXHJcbiAqICAgVmFsaWRhdGlvbkNoZWNrZXJcclxuICogfSBmcm9tICdndG0tYWdlbnQtc2tpbGxzJztcclxuICogYGBgXHJcbiAqL1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT0gVHlwZXMgPT09PT09PT09PT09PT09PT09PT1cclxuZXhwb3J0ICogZnJvbSAnLi90eXBlcyc7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBTa2lsbHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8vIERlcGVuZGVuY3kgUmVzb2x2ZXIgLSDsnZjsobTshLEg67aE7ISdIOuwjyDsg53shLEg7Iic7IScIOqysOyglVxyXG5leHBvcnQge1xyXG4gIERlcGVuZGVuY3lHcmFwaEJ1aWxkZXIsXHJcbiAgZXh0cmFjdFRhZ0RlcGVuZGVuY2llcyxcclxuICBleHRyYWN0VHJpZ2dlckRlcGVuZGVuY2llcyxcclxuICBleHRyYWN0VmFyaWFibGVEZXBlbmRlbmNpZXMsXHJcbiAgZ2V0VmFyaWFibGVUeXBlSW5mbyxcclxuICBleHRyYWN0Q3VzdG9tRXZlbnROYW1lLFxyXG4gIGV4dHJhY3RQdXNoZWRFdmVudHMsXHJcbiAgZXh0cmFjdFRlbXBsYXRlRXZlbnRzLFxyXG4gIGFkZEtub3duVGVtcGxhdGVFdmVudHMsXHJcbiAgZ2V0QWxsS25vd25FdmVudHMsXHJcbiAgS05PV05fVEVNUExBVEVfRVZFTlRTLFxyXG4gIERlcGVuZGVuY3lUeXBlXHJcbn0gZnJvbSAnLi9kZXBlbmRlbmN5LXJlc29sdmVyJztcclxuZXhwb3J0IHR5cGUgeyBHVE1NQ1BBZGFwdGVyLCBCdWlsZE9wdGlvbnMgfSBmcm9tICcuL2RlcGVuZGVuY3ktcmVzb2x2ZXInO1xyXG5cclxuLy8gSUQgTWFwcGVyIC0gU291cmNlL1RhcmdldCBJRCDrp6TtlZEg6rSA66asXHJcbmV4cG9ydCB7XHJcbiAgSWRNYXBwZXIsXHJcbiAgZ2V0U2Vzc2lvbk1hcHBlcixcclxuICBjbGVhclNlc3Npb25NYXBwZXIsXHJcbiAgY2xlYXJBbGxTZXNzaW9uTWFwcGVyc1xyXG59IGZyb20gJy4vaWQtbWFwcGVyJztcclxuXHJcbi8vIENvbmZpZyBUcmFuc2Zvcm1lciAtIOyXlO2LsO2LsCBDb25maWcg67OA7ZmYXHJcbmV4cG9ydCB7XHJcbiAgQ29uZmlnVHJhbnNmb3JtZXIsXHJcbiAgZXh0cmFjdENyZWF0ZUNvbmZpZyxcclxuICBjb21wYXJlQ29uZmlnc1xyXG59IGZyb20gJy4vY29uZmlnLXRyYW5zZm9ybWVyJztcclxuZXhwb3J0IHR5cGUgeyBUcmFuc2Zvcm1PcHRpb25zIH0gZnJvbSAnLi9jb25maWctdHJhbnNmb3JtZXInO1xyXG5cclxuLy8gUmVmZXJlbmNlIE1hdGNoZXIgLSDsnKDsgqwg7JeU7Yuw7YuwIOqygOyDiVxyXG5leHBvcnQge1xyXG4gIFJlZmVyZW5jZU1hdGNoZXIsXHJcbiAgdGFnVG9TZWFyY2hhYmxlVGV4dCxcclxuICBncm91cFNpbWlsYXJUYWdzXHJcbn0gZnJvbSAnLi9yZWZlcmVuY2UtbWF0Y2hlcic7XHJcbmV4cG9ydCB0eXBlIHsgU2VhcmNoUmVzdWx0LCBTZWFyY2hPcHRpb25zLCBTaW1pbGFyaXR5T3B0aW9ucyB9IGZyb20gJy4vcmVmZXJlbmNlLW1hdGNoZXInO1xyXG5cclxuLy8gTmFtaW5nIFBhcnNlciAtIOuqheuqhSDqt5zsuZkg67aE7ISdIOuwjyDsoIHsmqlcclxuZXhwb3J0IHtcclxuICBOYW1pbmdQYXJzZXIsXHJcbiAgR1RNX05BTUlOR19URU1QTEFURVMsXHJcbiAgaW5mZXJFbnRpdHlUeXBlRnJvbU5hbWVcclxufSBmcm9tICcuL25hbWluZy1wYXJzZXInO1xyXG5cclxuLy8gVmFsaWRhdGlvbiBDaGVja2VyIC0g7IOd7ISxIOqysOqzvCDqsoDspp1cclxuZXhwb3J0IHtcclxuICBWYWxpZGF0aW9uQ2hlY2tlcixcclxuICBmb3JtYXRWYWxpZGF0aW9uUmVwb3J0XHJcbn0gZnJvbSAnLi92YWxpZGF0aW9uLWNoZWNrZXInO1xyXG5leHBvcnQgdHlwZSB7IFZhbGlkYXRpb25JbnB1dCwgSW50ZWdyaXR5Q2hlY2tSZXN1bHQsIEludGVncml0eUlzc3VlIH0gZnJvbSAnLi92YWxpZGF0aW9uLWNoZWNrZXInO1xyXG4iXX0=