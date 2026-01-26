/**
 * Dependency & Analysis Types
 * 의존성 추적 및 분석 결과 타입
 */
import { EntityType, GTMEntity } from './gtm';
export declare enum DependencyType {
    DIRECT_REFERENCE = "direct",// {{variableName}}
    TRIGGER_CONDITION = "trigger_cond",// Trigger에서 변수 사용
    PARAMETER_VALUE = "param_value",// 태그 파라미터에서 사용
    JS_INTERNAL_REF = "js_internal",// JS 변수 내부에서 참조
    LOOKUP_INPUT = "lookup_input",// Lookup Table 입력
    LOOKUP_OUTPUT = "lookup_output",// Lookup Table 출력 값
    TEMPLATE_PARAM = "template_param",// Template 파라미터
    CONFIG_TAG_REF = "config_ref",// GA4 Config Tag 참조
    SETUP_TAG = "setup_tag",// Setup Tag
    TEARDOWN_TAG = "teardown_tag",// Teardown Tag
    FIRING_TRIGGER = "firing_trigger",// 실행 트리거
    BLOCKING_TRIGGER = "blocking_trigger",// 차단 트리거
    EVENT_PUSHER = "event_pusher"
}
export interface DependencyNode {
    entityType: EntityType;
    entityId: string;
    name: string;
    data: GTMEntity;
    variableType?: string;
    dependencies: DependencyEdge[];
    isHubVariable?: boolean;
}
export interface DependencyEdge {
    targetId: string;
    targetType: EntityType;
    dependencyType: DependencyType;
    location: string;
    variableName?: string;
    tagName?: string;
    note?: string;
}
export interface DependencyGraph {
    rootId: string;
    rootName: string;
    nodes: Map<string, DependencyNode>;
    creationOrder: string[];
}
export interface AnalysisSummary {
    total: number;
    tags: number;
    triggers: number;
    variables: number;
    templates: number;
    jsVariablesWithInternalRefs: number;
}
export interface AnalysisResult {
    summary: AnalysisSummary;
    creationOrder: CreationOrderItem[];
    nodes: Record<string, NodeInfo>;
    treeVisualization?: string;
    mermaidDiagram?: string;
}
export interface CreationOrderItem {
    step: number;
    type: EntityType;
    id: string;
    name: string;
}
export interface NodeInfo {
    type: EntityType;
    name: string;
    variableType?: string;
    dependencies: string[];
    data: GTMEntity;
}
export interface IdMappingEntry {
    newId: string;
    type: EntityType;
    name: string;
}
export interface IdMapping {
    [originalId: string]: IdMappingEntry;
}
export interface CreationPlan {
    steps: CreationStep[];
    warnings: string[];
    estimatedApiCalls: number;
}
export interface CreationStep {
    step: number;
    action: 'CREATE' | 'SKIP' | 'UPDATE';
    type: EntityType;
    originalId: string;
    originalName: string;
    newName: string;
    dependencies: string[];
    config: any;
    targetId?: string;
}
export interface CreationResult {
    success: boolean;
    createdCount: number;
    skippedCount: number;
    createdEntities: CreatedEntity[];
    idMapping: IdMapping;
    errors: CreationError[];
}
export interface CreatedEntity {
    type: EntityType;
    originalId: string;
    newId: string;
    name: string;
}
export interface CreationError {
    entityId: string;
    entityName: string;
    error: string;
    recoverable: boolean;
}
export interface ValidationReport {
    success: boolean;
    timestamp: string;
    source: WorkspaceRef;
    target: WorkspaceRef;
    summary: ValidationSummary;
    missing: MissingEntity[];
    brokenReferences: BrokenReference[];
    warnings: string[];
}
export interface WorkspaceRef {
    containerId: string;
    workspaceId: string;
    entityCount: number;
}
export interface ValidationSummary {
    expectedCount: number;
    actualCount: number;
    missingCount: number;
    brokenRefCount: number;
}
export interface MissingEntity {
    type: EntityType;
    originalId: string;
    name: string;
    reason?: string;
}
export interface BrokenReference {
    entityType: EntityType;
    entityId: string;
    entityName: string;
    referenceType: DependencyType;
    missingTargetId: string;
    missingTargetName?: string;
}
export interface NamingPattern {
    separator: string;
    segments: PatternSegment[];
    confidence: number;
    examples: string[];
}
export interface PatternSegment {
    type: 'literal' | 'variable';
    value: string;
    possibleValues?: string[];
}
export interface NamingValidation {
    valid: boolean;
    matchedPattern?: NamingPattern;
    suggestedName?: string;
    issues?: string[];
}
