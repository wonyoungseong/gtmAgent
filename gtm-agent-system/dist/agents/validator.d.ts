/**
 * Validator Agent
 * 엔티티 생성 결과 검증
 */
import { ValidationReport, IdMapping, GTMTag, GTMTrigger, GTMVariable } from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';
export interface ValidateRequest {
    sourceEntities: {
        tags: GTMTag[];
        triggers: GTMTrigger[];
        variables: GTMVariable[];
    };
    idMapping: IdMapping;
    sourceWorkspace?: {
        containerId: string;
        workspaceId: string;
    };
    targetWorkspace?: {
        containerId: string;
        workspaceId: string;
    };
}
export interface PreValidateRequest {
    entitiesToCreate: {
        tags: Partial<GTMTag>[];
        triggers: Partial<GTMTrigger>[];
        variables: Partial<GTMVariable>[];
    };
}
export interface IntegrityCheckRequest {
}
export declare class ValidatorAgent extends BaseAgent {
    private checker;
    constructor();
    /**
     * 요청 처리
     */
    execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>>;
    /**
     * 생성 결과 검증
     */
    private validate;
    /**
     * 사전 검증 (생성 전)
     */
    private preValidate;
    /**
     * 참조 무결성 검사
     */
    private checkIntegrity;
    /**
     * 검증 리포트 포맷팅
     */
    formatReport(report: ValidationReport): string;
}
