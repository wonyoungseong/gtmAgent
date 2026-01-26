/**
 * Dependency Graph Builder
 *
 * GTM MCP를 통해 엔티티를 조회하고 의존성 그래프를 구축합니다.
 * - BFS로 전체 의존성 탐색
 * - Topological Sort로 생성 순서 결정
 */
import { GTMTag, GTMTrigger, GTMVariable, GTMTemplate } from '../types/gtm';
import { DependencyGraph, AnalysisResult } from '../types/dependency';
/**
 * GTM MCP 호출을 위한 어댑터 인터페이스
 * Agent가 실제 MCP 호출을 주입합니다.
 */
export interface GTMMCPAdapter {
    getTag(tagId: string): Promise<GTMTag | null>;
    getTrigger(triggerId: string): Promise<GTMTrigger | null>;
    getVariable(variableId: string): Promise<GTMVariable | null>;
    getTemplate(templateId: string): Promise<GTMTemplate | null>;
    findVariableByName(name: string): Promise<GTMVariable | null>;
    findTagByName(name: string): Promise<GTMTag | null>;
    findTemplateByName?(name: string): Promise<GTMTemplate | null>;
    listTags(): Promise<GTMTag[]>;
    listTriggers(): Promise<GTMTrigger[]>;
    listVariables(): Promise<GTMVariable[]>;
    listTemplates(): Promise<GTMTemplate[]>;
    createTemplate?(config: Partial<GTMTemplate>): Promise<GTMTemplate>;
}
/**
 * 그래프 빌드 옵션
 */
export interface BuildOptions {
    /**
     * 역추적 활성화 여부
     * true: CustomEvent 트리거가 감지하는 이벤트를 push하는 태그도 추적
     * true: setupTag/teardownTag으로 선택된 태그를 사용하는 태그도 추적
     */
    enableReverseTracking?: boolean;
    /**
     * 역추적용 전체 워크스페이스 태그
     * 선택된 태그와 별도로, 역추적 시 검색 대상이 되는 모든 태그
     */
    allWorkspaceTags?: GTMTag[];
}
export declare class DependencyGraphBuilder {
    private adapter;
    private nodes;
    private visited;
    private variableNameCache;
    constructor(adapter: GTMMCPAdapter);
    /**
     * 태그에서 시작하여 전체 의존성 그래프 구축
     */
    buildFromTag(tagId: string): Promise<DependencyGraph>;
    /**
     * 여러 태그에서 시작하여 통합 그래프 구축
     */
    buildFromTags(tagIds: string[]): Promise<DependencyGraph>;
    /**
     * 기존 엔티티 데이터로 그래프 구축 (API 호출 없이)
     * 선택된 태그에서 도달 가능한 엔티티만 포함
     *
     * @param tags - 선택된 태그들 (시작점)
     * @param triggers - 전체 트리거 목록
     * @param variables - 전체 변수 목록
     * @param options - 빌드 옵션 (역추적 설정 등)
     * @param templates - 전체 템플릿 목록 (선택)
     */
    buildFromEntities(tags: GTMTag[], triggers: GTMTrigger[], variables: GTMVariable[], options?: BuildOptions, templates?: GTMTemplate[]): DependencyGraph;
    /**
     * 이벤트-태그 역방향 인덱스 구축
     * 모든 태그에서 push하는 이벤트를 추출하여 인덱스 생성
     */
    private buildEventTagIndex;
    /**
     * SetupTag/TeardownTag 역방향 인덱스 구축
     * 모든 태그에서 setupTag/teardownTag으로 사용하는 태그 이름을 추출하여 인덱스 생성
     */
    private buildTagSequenceIndex;
    /**
     * 분석 결과 생성 (Agent 반환용)
     */
    toAnalysisResult(graph: DependencyGraph): AnalysisResult;
    private reset;
    /**
     * BFS로 의존성 탐색
     */
    private bfsTraverse;
    /**
     * 엔티티 조회
     */
    private fetchEntity;
    /**
     * 이름으로 엔티티 검색
     */
    private findByName;
    /**
     * 의존성 추출
     */
    private extractDependencies;
    /**
     * name: 참조를 실제 ID로 변환
     */
    private resolveNameReferences;
    /**
     * Topological Sort (Kahn's Algorithm)
     * 개선: 누락된 노드 검증 및 복구
     */
    private topologicalSort;
    /**
     * 타입별 정렬 (Template → Variable → Trigger → Tag)
     */
    private sortByEntityType;
    /**
     * 요약 생성
     */
    private createSummary;
}
