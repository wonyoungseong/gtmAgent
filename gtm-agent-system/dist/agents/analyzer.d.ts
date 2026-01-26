/**
 * Analyzer Agent
 * Source 워크스페이스 분석 및 의존성 그래프 생성
 */
import { AnalysisResult, GTMTag, GTMTrigger, GTMVariable, GTMTemplate } from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';
export interface AnalyzeTagsRequest {
    tagIds: string[];
    includeAllDependencies?: boolean;
}
export interface AnalyzeWorkspaceRequest {
    tagFilter?: {
        types?: string[];
        namePattern?: string;
        limit?: number;
    };
}
export interface AnalysisData {
    analysisResult: AnalysisResult;
    sourceEntities: {
        tags: GTMTag[];
        triggers: GTMTrigger[];
        variables: GTMVariable[];
        templates: GTMTemplate[];
    };
}
export declare class AnalyzerAgent extends BaseAgent {
    constructor();
    /**
     * 요청 처리
     */
    execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>>;
    /**
     * 특정 태그들 분석
     */
    private analyzeTags;
    /**
     * 전체 워크스페이스 분석
     */
    private analyzeWorkspace;
    /**
     * 모든 엔티티 목록 조회
     */
    private listAllEntities;
}
