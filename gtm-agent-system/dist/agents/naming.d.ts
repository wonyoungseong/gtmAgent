/**
 * Naming Agent
 * 명명 패턴 분석 및 새 이름 생성
 */
import { NamingPattern, GTMTag, GTMTrigger, GTMVariable, EntityType, GTM_NAMING_TEMPLATES } from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';
export interface ExtractPatternRequest {
    names: string[];
    entityType?: EntityType;
}
export interface GenerateNamesRequest {
    sourceEntities: {
        tags: GTMTag[];
        triggers: GTMTrigger[];
        variables: GTMVariable[];
    };
    targetPattern?: NamingPattern;
    namePrefix?: string;
    nameSuffix?: string;
}
export interface NamingResult {
    pattern?: NamingPattern;
    nameMap: Map<string, string>;
}
export declare class NamingAgent extends BaseAgent {
    private parser;
    constructor();
    /**
     * 요청 처리
     */
    execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>>;
    /**
     * 이름 목록에서 패턴 추출
     */
    private extractPattern;
    /**
     * 새 이름 생성
     */
    private generateNames;
    /**
     * 전체 패턴 분석
     */
    private analyzePatterns;
    /**
     * 엔티티 이름 생성
     */
    private generateEntityName;
    /**
     * 표준 템플릿 반환
     */
    getStandardTemplates(): typeof GTM_NAMING_TEMPLATES;
}
