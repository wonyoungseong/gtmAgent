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

export { DependencyGraphBuilder, GTMMCPAdapter, BuildOptions } from './graph-builder';
export {
  extractTagDependencies,
  extractTriggerDependencies,
  extractVariableDependencies,
  getVariableTypeInfo,
  extractCustomEventName,
  extractPushedEvents
} from './parsers';
export {
  extractTemplateEvents,
  addKnownTemplateEvents,
  getAllKnownEvents,
  KNOWN_TEMPLATE_EVENTS
} from './known-event-pushers';

// Re-export types
export type {
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  AnalysisResult,
  AnalysisSummary,
  CreationOrderItem,
  NodeInfo
} from '../types/dependency';
export { DependencyType } from '../types/dependency';
