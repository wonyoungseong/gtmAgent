"use strict";
/**
 * Dependency Resolver Skill
 *
 * GTM 엔티티 간 의존성을 분석하고 생성 순서를 결정합니다.
 *
 * @example
 * ```typescript
 * // MCP 어댑터 생성 (Agent에서 주입)
 * const adapter: GTMMCPAdapter = {
 *   getTag: async (id) => await mcpCall('gtm_tag', { action: 'get', tagId: id }),
 *   // ... 기타 메서드
 * };
 *
 * // 그래프 빌더 생성
 * const builder = new DependencyGraphBuilder(adapter);
 *
 * // 태그 의존성 분석
 * const graph = await builder.buildFromTag('123');
 * const result = builder.toAnalysisResult(graph);
 *
 * console.log(result.creationOrder);
 * // [{ step: 1, type: 'variable', id: '456', name: 'DLV - user_id' }, ...]
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyType = exports.KNOWN_TEMPLATE_EVENTS = exports.getAllKnownEvents = exports.addKnownTemplateEvents = exports.extractTemplateEvents = exports.extractPushedEvents = exports.extractCustomEventName = exports.getVariableTypeInfo = exports.extractVariableDependencies = exports.extractTriggerDependencies = exports.extractTagDependencies = exports.DependencyGraphBuilder = void 0;
var graph_builder_1 = require("./graph-builder");
Object.defineProperty(exports, "DependencyGraphBuilder", { enumerable: true, get: function () { return graph_builder_1.DependencyGraphBuilder; } });
var parsers_1 = require("./parsers");
Object.defineProperty(exports, "extractTagDependencies", { enumerable: true, get: function () { return parsers_1.extractTagDependencies; } });
Object.defineProperty(exports, "extractTriggerDependencies", { enumerable: true, get: function () { return parsers_1.extractTriggerDependencies; } });
Object.defineProperty(exports, "extractVariableDependencies", { enumerable: true, get: function () { return parsers_1.extractVariableDependencies; } });
Object.defineProperty(exports, "getVariableTypeInfo", { enumerable: true, get: function () { return parsers_1.getVariableTypeInfo; } });
Object.defineProperty(exports, "extractCustomEventName", { enumerable: true, get: function () { return parsers_1.extractCustomEventName; } });
Object.defineProperty(exports, "extractPushedEvents", { enumerable: true, get: function () { return parsers_1.extractPushedEvents; } });
var known_event_pushers_1 = require("./known-event-pushers");
Object.defineProperty(exports, "extractTemplateEvents", { enumerable: true, get: function () { return known_event_pushers_1.extractTemplateEvents; } });
Object.defineProperty(exports, "addKnownTemplateEvents", { enumerable: true, get: function () { return known_event_pushers_1.addKnownTemplateEvents; } });
Object.defineProperty(exports, "getAllKnownEvents", { enumerable: true, get: function () { return known_event_pushers_1.getAllKnownEvents; } });
Object.defineProperty(exports, "KNOWN_TEMPLATE_EVENTS", { enumerable: true, get: function () { return known_event_pushers_1.KNOWN_TEMPLATE_EVENTS; } });
var dependency_1 = require("../types/dependency");
Object.defineProperty(exports, "DependencyType", { enumerable: true, get: function () { return dependency_1.DependencyType; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvZGVwZW5kZW5jeS1yZXNvbHZlci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBdUJHOzs7QUFFSCxpREFBc0Y7QUFBN0UsdUhBQUEsc0JBQXNCLE9BQUE7QUFDL0IscUNBT21CO0FBTmpCLGlIQUFBLHNCQUFzQixPQUFBO0FBQ3RCLHFIQUFBLDBCQUEwQixPQUFBO0FBQzFCLHNIQUFBLDJCQUEyQixPQUFBO0FBQzNCLDhHQUFBLG1CQUFtQixPQUFBO0FBQ25CLGlIQUFBLHNCQUFzQixPQUFBO0FBQ3RCLDhHQUFBLG1CQUFtQixPQUFBO0FBRXJCLDZEQUsrQjtBQUo3Qiw0SEFBQSxxQkFBcUIsT0FBQTtBQUNyQiw2SEFBQSxzQkFBc0IsT0FBQTtBQUN0Qix3SEFBQSxpQkFBaUIsT0FBQTtBQUNqQiw0SEFBQSxxQkFBcUIsT0FBQTtBQWF2QixrREFBcUQ7QUFBNUMsNEdBQUEsY0FBYyxPQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIERlcGVuZGVuY3kgUmVzb2x2ZXIgU2tpbGxcclxuICpcclxuICogR1RNIOyXlO2LsO2LsCDqsIQg7J2Y7KG07ISx7J2EIOu2hOyEne2VmOqzoCDsg53shLEg7Iic7ISc66W8IOqysOygle2VqeuLiOuLpC5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBgdHlwZXNjcmlwdFxyXG4gKiAvLyBNQ1Ag7Ja064yR7YSwIOyDneyEsSAoQWdlbnTsl5DshJwg7KO87J6FKVxyXG4gKiBjb25zdCBhZGFwdGVyOiBHVE1NQ1BBZGFwdGVyID0ge1xyXG4gKiAgIGdldFRhZzogYXN5bmMgKGlkKSA9PiBhd2FpdCBtY3BDYWxsKCdndG1fdGFnJywgeyBhY3Rpb246ICdnZXQnLCB0YWdJZDogaWQgfSksXHJcbiAqICAgLy8gLi4uIOq4sO2DgCDrqZTshJzrk5xcclxuICogfTtcclxuICpcclxuICogLy8g6re4656Y7ZSEIOu5jOuNlCDsg53shLFcclxuICogY29uc3QgYnVpbGRlciA9IG5ldyBEZXBlbmRlbmN5R3JhcGhCdWlsZGVyKGFkYXB0ZXIpO1xyXG4gKlxyXG4gKiAvLyDtg5zqt7gg7J2Y7KG07ISxIOu2hOyEnVxyXG4gKiBjb25zdCBncmFwaCA9IGF3YWl0IGJ1aWxkZXIuYnVpbGRGcm9tVGFnKCcxMjMnKTtcclxuICogY29uc3QgcmVzdWx0ID0gYnVpbGRlci50b0FuYWx5c2lzUmVzdWx0KGdyYXBoKTtcclxuICpcclxuICogY29uc29sZS5sb2cocmVzdWx0LmNyZWF0aW9uT3JkZXIpO1xyXG4gKiAvLyBbeyBzdGVwOiAxLCB0eXBlOiAndmFyaWFibGUnLCBpZDogJzQ1NicsIG5hbWU6ICdETFYgLSB1c2VyX2lkJyB9LCAuLi5dXHJcbiAqIGBgYFxyXG4gKi9cclxuXHJcbmV4cG9ydCB7IERlcGVuZGVuY3lHcmFwaEJ1aWxkZXIsIEdUTU1DUEFkYXB0ZXIsIEJ1aWxkT3B0aW9ucyB9IGZyb20gJy4vZ3JhcGgtYnVpbGRlcic7XHJcbmV4cG9ydCB7XHJcbiAgZXh0cmFjdFRhZ0RlcGVuZGVuY2llcyxcclxuICBleHRyYWN0VHJpZ2dlckRlcGVuZGVuY2llcyxcclxuICBleHRyYWN0VmFyaWFibGVEZXBlbmRlbmNpZXMsXHJcbiAgZ2V0VmFyaWFibGVUeXBlSW5mbyxcclxuICBleHRyYWN0Q3VzdG9tRXZlbnROYW1lLFxyXG4gIGV4dHJhY3RQdXNoZWRFdmVudHNcclxufSBmcm9tICcuL3BhcnNlcnMnO1xyXG5leHBvcnQge1xyXG4gIGV4dHJhY3RUZW1wbGF0ZUV2ZW50cyxcclxuICBhZGRLbm93blRlbXBsYXRlRXZlbnRzLFxyXG4gIGdldEFsbEtub3duRXZlbnRzLFxyXG4gIEtOT1dOX1RFTVBMQVRFX0VWRU5UU1xyXG59IGZyb20gJy4va25vd24tZXZlbnQtcHVzaGVycyc7XHJcblxyXG4vLyBSZS1leHBvcnQgdHlwZXNcclxuZXhwb3J0IHR5cGUge1xyXG4gIERlcGVuZGVuY3lOb2RlLFxyXG4gIERlcGVuZGVuY3lFZGdlLFxyXG4gIERlcGVuZGVuY3lHcmFwaCxcclxuICBBbmFseXNpc1Jlc3VsdCxcclxuICBBbmFseXNpc1N1bW1hcnksXHJcbiAgQ3JlYXRpb25PcmRlckl0ZW0sXHJcbiAgTm9kZUluZm9cclxufSBmcm9tICcuLi90eXBlcy9kZXBlbmRlbmN5JztcclxuZXhwb3J0IHsgRGVwZW5kZW5jeVR5cGUgfSBmcm9tICcuLi90eXBlcy9kZXBlbmRlbmN5JztcclxuIl19