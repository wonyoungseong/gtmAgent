/**
 * Planner Agent
 * 신규 태그 판단 및 생성 계획 수립
 */
import { AnalysisResult, GTMTag, GTMTrigger, GTMVariable, GTMTemplate } from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';
import { TargetEntities } from '../types/workflow';
export interface CreatePlanRequest {
    analysisResult: AnalysisResult;
    sourceEntities: {
        tags: GTMTag[];
        triggers: GTMTrigger[];
        variables: GTMVariable[];
        templates: GTMTemplate[];
    };
    nameMap?: Map<string, string>;
    skipExisting?: boolean;
    targetEntities?: TargetEntities;
}
export interface FindSimilarRequest {
    sourceTag: GTMTag;
    threshold?: number;
}
export interface CheckNewTagRequest {
    tagName: string;
    eventName?: string;
}
export declare class PlannerAgent extends BaseAgent {
    private matcher?;
    constructor();
    /**
     * 요청 처리
     */
    execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>>;
    /**
     * 생성 계획 수립
     */
    private createPlan;
    /**
     * 유사 태그 검색
     */
    private findSimilarTags;
    /**
     * 신규 태그 여부 확인
     */
    private checkNewTag;
    /**
     * 엔티티 존재 여부 확인
     */
    private checkExists;
    /**
     * 기존 엔티티 찾기 (ID 포함)
     */
    private findExisting;
}
