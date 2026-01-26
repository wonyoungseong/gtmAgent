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

// ==================== Types ====================
export * from './types';

// ==================== Skills ====================

// Dependency Resolver - 의존성 분석 및 생성 순서 결정
export {
  DependencyGraphBuilder,
  extractTagDependencies,
  extractTriggerDependencies,
  extractVariableDependencies,
  getVariableTypeInfo,
  extractCustomEventName,
  extractPushedEvents,
  extractTemplateEvents,
  addKnownTemplateEvents,
  getAllKnownEvents,
  KNOWN_TEMPLATE_EVENTS,
  DependencyType
} from './dependency-resolver';
export type { GTMMCPAdapter, BuildOptions } from './dependency-resolver';

// ID Mapper - Source/Target ID 매핑 관리
export {
  IdMapper,
  getSessionMapper,
  clearSessionMapper,
  clearAllSessionMappers
} from './id-mapper';

// Config Transformer - 엔티티 Config 변환
export {
  ConfigTransformer,
  extractCreateConfig,
  compareConfigs
} from './config-transformer';
export type { TransformOptions } from './config-transformer';

// Reference Matcher - 유사 엔티티 검색
export {
  ReferenceMatcher,
  tagToSearchableText,
  groupSimilarTags
} from './reference-matcher';
export type { SearchResult, SearchOptions, SimilarityOptions } from './reference-matcher';

// Naming Parser - 명명 규칙 분석 및 적용
export {
  NamingParser,
  GTM_NAMING_TEMPLATES,
  inferEntityTypeFromName
} from './naming-parser';

// Validation Checker - 생성 결과 검증
export {
  ValidationChecker,
  formatValidationReport
} from './validation-checker';
export type { ValidationInput, IntegrityCheckResult, IntegrityIssue } from './validation-checker';
