/**
 * Builder Agent
 * Target 워크스페이스에 엔티티 생성
 */
import { IdMapper, EntityType, GTMTag, GTMTrigger, GTMVariable, CreationPlan, CreatedEntity, IdMapping } from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';
import { RollbackResult } from '../types/workflow';
export interface BuildRequest {
    creationPlan: CreationPlan;
    nameMap?: Map<string, string>;
    dryRun?: boolean;
}
export interface BuildSingleRequest {
    entityType: EntityType;
    sourceEntity: GTMTag | GTMTrigger | GTMVariable;
    newName?: string;
}
export interface BuildResult {
    success: boolean;
    partialSuccess: boolean;
    createdEntities: CreatedEntity[];
    idMapping: IdMapping;
    skippedCount: number;
    errors: Array<{
        entityId: string;
        entityName: string;
        error: string;
    }>;
    rollbackResult?: RollbackResult;
}
export declare class BuilderAgent extends BaseAgent {
    private idMapper;
    constructor();
    /**
     * Delay helper
     */
    private delay;
    /**
     * Calculate exponential backoff delay
     */
    private calculateBackoffDelay;
    /**
     * Check if error is a rate limit error
     */
    private isRateLimitError;
    /**
     * Create entity with automatic retry for rate limit errors
     */
    private createEntityWithRetry;
    /**
     * 요청 처리
     */
    execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>>;
    /**
     * 생성 계획 실행
     */
    private build;
    /**
     * 단일 엔티티 생성
     */
    private buildSingle;
    /**
     * 롤백 실행
     */
    private rollback;
    /**
     * 엔티티 생성
     */
    private createEntity;
    /**
     * 중복 검사
     */
    private checkDuplicate;
    /**
     * 롤백 수행 (with detailed result tracking)
     */
    private performRollback;
    /**
     * ID Mapper 반환
     */
    getIdMapper(): IdMapper;
    /**
     * ID Mapper 초기화
     */
    resetIdMapper(): void;
}
