/**
 * Validator Agent
 * 엔티티 생성 결과 검증
 */

import {
  ValidationChecker,
  formatValidationReport,
  ValidationReport,
  IdMapping,
  GTMTag,
  GTMTrigger,
  GTMVariable
} from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';
import { ValidationError } from '../utils/error';

// ==================== Request/Response Types ====================

export interface ValidateRequest {
  sourceEntities: {
    tags: GTMTag[];
    triggers: GTMTrigger[];
    variables: GTMVariable[];
  };
  idMapping: IdMapping;
  sourceWorkspace?: { containerId: string; workspaceId: string };
  targetWorkspace?: { containerId: string; workspaceId: string };
}

export interface PreValidateRequest {
  entitiesToCreate: {
    tags: Partial<GTMTag>[];
    triggers: Partial<GTMTrigger>[];
    variables: Partial<GTMVariable>[];
  };
}

export interface IntegrityCheckRequest {
  // No additional data needed, uses target workspace entities
}

// ==================== Validator Agent ====================

export class ValidatorAgent extends BaseAgent {
  private checker: ValidationChecker;

  constructor() {
    super('validator');
    this.checker = new ValidationChecker();
  }

  /**
   * 요청 처리
   */
  async execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>> {
    this.validateContext();

    switch (request.action) {
      case 'validate':
        return this.validate(request.data as ValidateRequest) as Promise<AgentResponse<R>>;

      case 'preValidate':
        return this.preValidate(request.data as PreValidateRequest) as Promise<AgentResponse<R>>;

      case 'checkIntegrity':
        return this.checkIntegrity() as Promise<AgentResponse<R>>;

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  /**
   * 생성 결과 검증
   */
  private async validate(
    request: ValidateRequest
  ): Promise<AgentResponse<ValidationReport>> {
    return this.safeExecute(
      { action: 'validate', data: request, context: this.context! },
      async () => {
        this.logger.info('Starting validation');

        // 1. Target 워크스페이스 엔티티 조회
        this.reportProgress(1, 3, 'Fetching target entities');
        const [targetTags, targetTriggers, targetVariables] = await Promise.all([
          this.mcp!.listTags({ refresh: true }),
          this.mcp!.listTriggers({ refresh: true }),
          this.mcp!.listVariables({ refresh: true })
        ]);

        this.reportProgress(2, 3, 'Running validation checks');

        // 2. 검증 수행
        const report = this.checker.validate({
          sourceEntities: request.sourceEntities,
          targetEntities: {
            tags: targetTags,
            triggers: targetTriggers,
            variables: targetVariables
          },
          idMapping: request.idMapping,
          sourceWorkspace: request.sourceWorkspace,
          targetWorkspace: request.targetWorkspace || {
            containerId: this.context!.targetWorkspace.containerId,
            workspaceId: this.context!.targetWorkspace.workspaceId
          }
        });

        this.reportProgress(3, 3, 'Validation completed');

        // 3. 결과 로깅
        if (report.success) {
          this.logger.info('Validation passed', report.summary);
        } else {
          this.logger.warn('Validation failed', {
            missing: report.missing.length,
            brokenRefs: report.brokenReferences.length,
            warnings: report.warnings.length
          });
        }

        return report;
      }
    );
  }

  /**
   * 사전 검증 (생성 전)
   */
  private async preValidate(
    request: PreValidateRequest
  ): Promise<AgentResponse<{
    canCreate: boolean;
    conflicts: Array<{ type: string; name: string; reason: string }>;
  }>> {
    return this.safeExecute(
      { action: 'preValidate', data: request, context: this.context! },
      async () => {
        this.logger.info('Starting pre-validation');

        // 기존 엔티티 조회
        const [existingTags, existingTriggers, existingVariables] = await Promise.all([
          this.mcp!.listTags(),
          this.mcp!.listTriggers(),
          this.mcp!.listVariables()
        ]);

        // 사전 검증 수행
        const result = this.checker.preValidate(
          request.entitiesToCreate,
          {
            tags: existingTags,
            triggers: existingTriggers,
            variables: existingVariables
          }
        );

        this.logger.info('Pre-validation completed', {
          canCreate: result.canCreate,
          conflicts: result.conflicts.length
        });

        return {
          canCreate: result.canCreate,
          conflicts: result.conflicts.map(c => ({
            type: c.type,
            name: c.name,
            reason: c.reason
          }))
        };
      }
    );
  }

  /**
   * 참조 무결성 검사
   */
  private async checkIntegrity(): Promise<AgentResponse<{
    valid: boolean;
    issues: Array<{
      entityType: string;
      entityName: string;
      issueType: string;
      details: string;
    }>;
  }>> {
    return this.safeExecute(
      { action: 'checkIntegrity', data: {}, context: this.context! },
      async () => {
        this.logger.info('Checking reference integrity');

        // 모든 엔티티 조회
        const [tags, triggers, variables] = await Promise.all([
          this.mcp!.listTags({ refresh: true }),
          this.mcp!.listTriggers({ refresh: true }),
          this.mcp!.listVariables({ refresh: true })
        ]);

        // 무결성 검사
        const result = this.checker.checkIntegrity({ tags, triggers, variables });

        this.logger.info('Integrity check completed', {
          valid: result.valid,
          issues: result.issues.length
        });

        return {
          valid: result.valid,
          issues: result.issues.map(i => ({
            entityType: i.entityType,
            entityName: i.entityName,
            issueType: i.issueType,
            details: i.details
          }))
        };
      }
    );
  }

  /**
   * 검증 리포트 포맷팅
   */
  formatReport(report: ValidationReport): string {
    return formatValidationReport(report);
  }
}
