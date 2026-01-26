/**
 * Validation Checker Skill
 *
 * GTM 엔티티 생성 결과 검증
 * - Source와 Target 비교
 * - 참조 무결성 검사
 * - 누락 엔티티 탐지
 * - 검증 리포트 생성
 *
 * @example
 * ```typescript
 * const checker = new ValidationChecker();
 *
 * // 생성 결과 검증
 * const report = checker.validate({
 *   sourceEntities: { tags: [...], triggers: [...], variables: [...] },
 *   targetEntities: { tags: [...], triggers: [...], variables: [...] },
 *   idMapping: idMapper.getAll()
 * });
 *
 * if (!report.success) {
 *   console.log('Missing:', report.missing);
 *   console.log('Broken refs:', report.brokenReferences);
 * }
 * ```
 */
import { EntityType, GTMTag, GTMTrigger, GTMVariable } from '../types/gtm';
import { ValidationReport, IdMapping } from '../types/dependency';
export interface ValidationInput {
    sourceEntities: {
        tags: GTMTag[];
        triggers: GTMTrigger[];
        variables: GTMVariable[];
    };
    targetEntities: {
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
export interface IntegrityCheckResult {
    valid: boolean;
    issues: IntegrityIssue[];
}
export interface IntegrityIssue {
    entityType: EntityType;
    entityId: string;
    entityName: string;
    issueType: 'missing_trigger' | 'missing_variable' | 'missing_tag' | 'circular_reference';
    details: string;
}
export declare class ValidationChecker {
    /**
     * 전체 검증 수행
     */
    validate(input: ValidationInput): ValidationReport;
    /**
     * 참조 무결성만 검사
     */
    checkIntegrity(entities: {
        tags: GTMTag[];
        triggers: GTMTrigger[];
        variables: GTMVariable[];
    }): IntegrityCheckResult;
    /**
     * 생성 전 사전 검증
     */
    preValidate(entitiesToCreate: {
        tags: Partial<GTMTag>[];
        triggers: Partial<GTMTrigger>[];
        variables: Partial<GTMVariable>[];
    }, existingEntities: {
        tags: GTMTag[];
        triggers: GTMTrigger[];
        variables: GTMVariable[];
    }): {
        canCreate: boolean;
        conflicts: Array<{
            type: EntityType;
            name: string;
            reason: string;
        }>;
        dependencies: Array<{
            type: EntityType;
            name: string;
            missing: string[];
        }>;
    };
    private findMissingEntities;
    private checkReferenceIntegrity;
    private issueTypeToDepType;
    private generateWarnings;
    private extractVariableReferences;
    private extractVariableReferencesFromTrigger;
    private extractVariableReferencesFromVariable;
}
/**
 * 검증 리포트를 텍스트로 포맷
 */
export declare function formatValidationReport(report: ValidationReport): string;
