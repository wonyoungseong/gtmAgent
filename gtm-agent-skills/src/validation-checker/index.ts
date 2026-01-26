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

import {
  EntityType,
  GTMTag,
  GTMTrigger,
  GTMVariable
} from '../types/gtm';
import {
  ValidationReport,
  ValidationSummary,
  MissingEntity,
  BrokenReference,
  IdMapping,
  DependencyType
} from '../types/dependency';

// ==================== Types ====================

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
  sourceWorkspace?: { containerId: string; workspaceId: string };
  targetWorkspace?: { containerId: string; workspaceId: string };
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

// ==================== Validation Checker ====================

export class ValidationChecker {
  /**
   * 전체 검증 수행
   */
  validate(input: ValidationInput): ValidationReport {
    const {
      sourceEntities,
      targetEntities,
      idMapping,
      sourceWorkspace,
      targetWorkspace
    } = input;

    // 1. 누락 엔티티 확인
    const missing = this.findMissingEntities(sourceEntities, targetEntities, idMapping);

    // 2. 참조 무결성 검사
    const brokenReferences = this.checkReferenceIntegrity(targetEntities);

    // 3. 요약 생성
    const expectedCount =
      sourceEntities.tags.length +
      sourceEntities.triggers.length +
      sourceEntities.variables.length;

    const actualCount =
      targetEntities.tags.length +
      targetEntities.triggers.length +
      targetEntities.variables.length;

    const summary: ValidationSummary = {
      expectedCount,
      actualCount,
      missingCount: missing.length,
      brokenRefCount: brokenReferences.length
    };

    // 4. 경고 생성
    const warnings = this.generateWarnings(sourceEntities, targetEntities, idMapping);

    return {
      success: missing.length === 0 && brokenReferences.length === 0,
      timestamp: new Date().toISOString(),
      source: {
        containerId: sourceWorkspace?.containerId || 'unknown',
        workspaceId: sourceWorkspace?.workspaceId || 'unknown',
        entityCount: expectedCount
      },
      target: {
        containerId: targetWorkspace?.containerId || 'unknown',
        workspaceId: targetWorkspace?.workspaceId || 'unknown',
        entityCount: actualCount
      },
      summary,
      missing,
      brokenReferences,
      warnings
    };
  }

  /**
   * 참조 무결성만 검사
   */
  checkIntegrity(entities: {
    tags: GTMTag[];
    triggers: GTMTrigger[];
    variables: GTMVariable[];
  }): IntegrityCheckResult {
    const issues: IntegrityIssue[] = [];

    const triggerIds = new Set(entities.triggers.map(t => t.triggerId));
    const variableNames = new Set(entities.variables.map(v => v.name));
    const tagIds = new Set(entities.tags.map(t => t.tagId));
    const tagNames = new Set(entities.tags.map(t => t.name));

    // 태그 검사
    for (const tag of entities.tags) {
      // Firing Triggers 검사
      for (const triggerId of tag.firingTriggerId || []) {
        if (!triggerIds.has(triggerId)) {
          issues.push({
            entityType: EntityType.TAG,
            entityId: tag.tagId,
            entityName: tag.name,
            issueType: 'missing_trigger',
            details: `Firing trigger ${triggerId} not found`
          });
        }
      }

      // Blocking Triggers 검사
      for (const triggerId of tag.blockingTriggerId || []) {
        if (!triggerIds.has(triggerId)) {
          issues.push({
            entityType: EntityType.TAG,
            entityId: tag.tagId,
            entityName: tag.name,
            issueType: 'missing_trigger',
            details: `Blocking trigger ${triggerId} not found`
          });
        }
      }

      // 변수 참조 검사
      const varRefs = this.extractVariableReferences(tag);
      for (const varName of varRefs) {
        if (!variableNames.has(varName)) {
          issues.push({
            entityType: EntityType.TAG,
            entityId: tag.tagId,
            entityName: tag.name,
            issueType: 'missing_variable',
            details: `Variable "${varName}" not found`
          });
        }
      }

      // Setup/Teardown Tags 검사
      for (const setup of tag.setupTag || []) {
        const refId = setup.tagId || setup.tagName;
        const isFound = setup.tagId
          ? tagIds.has(setup.tagId)
          : (setup.tagName ? tagNames.has(setup.tagName) : true);
        if (!isFound && refId) {
          issues.push({
            entityType: EntityType.TAG,
            entityId: tag.tagId,
            entityName: tag.name,
            issueType: 'missing_tag',
            details: `Setup tag ${refId} not found`
          });
        }
      }
    }

    // 트리거 검사
    for (const trigger of entities.triggers) {
      const varRefs = this.extractVariableReferencesFromTrigger(trigger);
      for (const varName of varRefs) {
        if (!variableNames.has(varName)) {
          issues.push({
            entityType: EntityType.TRIGGER,
            entityId: trigger.triggerId,
            entityName: trigger.name,
            issueType: 'missing_variable',
            details: `Variable "${varName}" not found`
          });
        }
      }
    }

    // 변수 검사 (다른 변수 참조)
    for (const variable of entities.variables) {
      const varRefs = this.extractVariableReferencesFromVariable(variable);
      for (const varName of varRefs) {
        if (!variableNames.has(varName) && varName !== variable.name) {
          issues.push({
            entityType: EntityType.VARIABLE,
            entityId: variable.variableId,
            entityName: variable.name,
            issueType: 'missing_variable',
            details: `Variable "${varName}" not found`
          });
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 생성 전 사전 검증
   */
  preValidate(
    entitiesToCreate: {
      tags: Partial<GTMTag>[];
      triggers: Partial<GTMTrigger>[];
      variables: Partial<GTMVariable>[];
    },
    existingEntities: {
      tags: GTMTag[];
      triggers: GTMTrigger[];
      variables: GTMVariable[];
    }
  ): {
    canCreate: boolean;
    conflicts: Array<{ type: EntityType; name: string; reason: string }>;
    dependencies: Array<{ type: EntityType; name: string; missing: string[] }>;
  } {
    const conflicts: Array<{ type: EntityType; name: string; reason: string }> = [];
    const dependencies: Array<{ type: EntityType; name: string; missing: string[] }> = [];

    const existingTagNames = new Set(existingEntities.tags.map(t => t.name));
    const existingTriggerNames = new Set(existingEntities.triggers.map(t => t.name));
    const existingVarNames = new Set(existingEntities.variables.map(v => v.name));

    // 이름 충돌 검사
    for (const tag of entitiesToCreate.tags) {
      if (tag.name && existingTagNames.has(tag.name)) {
        conflicts.push({
          type: EntityType.TAG,
          name: tag.name,
          reason: 'Tag with same name already exists'
        });
      }
    }

    for (const trigger of entitiesToCreate.triggers) {
      if (trigger.name && existingTriggerNames.has(trigger.name)) {
        conflicts.push({
          type: EntityType.TRIGGER,
          name: trigger.name,
          reason: 'Trigger with same name already exists'
        });
      }
    }

    for (const variable of entitiesToCreate.variables) {
      if (variable.name && existingVarNames.has(variable.name)) {
        conflicts.push({
          type: EntityType.VARIABLE,
          name: variable.name,
          reason: 'Variable with same name already exists'
        });
      }
    }

    return {
      canCreate: conflicts.length === 0 && dependencies.every(d => d.missing.length === 0),
      conflicts,
      dependencies
    };
  }

  // ==================== Private Methods ====================

  private findMissingEntities(
    source: { tags: GTMTag[]; triggers: GTMTrigger[]; variables: GTMVariable[] },
    target: { tags: GTMTag[]; triggers: GTMTrigger[]; variables: GTMVariable[] },
    idMapping: IdMapping
  ): MissingEntity[] {
    const missing: MissingEntity[] = [];

    // 매핑된 ID 중 Target에 없는 것 찾기
    for (const [originalId, entry] of Object.entries(idMapping)) {
      const newId = entry.newId;

      switch (entry.type) {
        case EntityType.TAG:
          if (!target.tags.find(t => t.tagId === newId)) {
            missing.push({
              type: EntityType.TAG,
              originalId,
              name: entry.name,
              reason: 'Not found in target workspace'
            });
          }
          break;

        case EntityType.TRIGGER:
          if (!target.triggers.find(t => t.triggerId === newId)) {
            missing.push({
              type: EntityType.TRIGGER,
              originalId,
              name: entry.name,
              reason: 'Not found in target workspace'
            });
          }
          break;

        case EntityType.VARIABLE:
          if (!target.variables.find(v => v.variableId === newId)) {
            missing.push({
              type: EntityType.VARIABLE,
              originalId,
              name: entry.name,
              reason: 'Not found in target workspace'
            });
          }
          break;
      }
    }

    return missing;
  }

  private checkReferenceIntegrity(entities: {
    tags: GTMTag[];
    triggers: GTMTrigger[];
    variables: GTMVariable[];
  }): BrokenReference[] {
    const result = this.checkIntegrity(entities);

    return result.issues.map(issue => ({
      entityType: issue.entityType,
      entityId: issue.entityId,
      entityName: issue.entityName,
      referenceType: this.issueTypeToDepType(issue.issueType),
      missingTargetId: issue.details.split(' ')[1] || 'unknown',
      missingTargetName: issue.details
    }));
  }

  private issueTypeToDepType(issueType: string): DependencyType {
    switch (issueType) {
      case 'missing_trigger':
        return DependencyType.FIRING_TRIGGER;
      case 'missing_variable':
        return DependencyType.DIRECT_REFERENCE;
      case 'missing_tag':
        return DependencyType.CONFIG_TAG_REF;
      default:
        return DependencyType.DIRECT_REFERENCE;
    }
  }

  private generateWarnings(
    source: { tags: GTMTag[]; triggers: GTMTrigger[]; variables: GTMVariable[] },
    target: { tags: GTMTag[]; triggers: GTMTrigger[]; variables: GTMVariable[] },
    idMapping: IdMapping
  ): string[] {
    const warnings: string[] = [];

    // 매핑되지 않은 Source 엔티티
    const mappedIds = new Set(Object.keys(idMapping));

    const unmappedTags = source.tags.filter(t => !mappedIds.has(t.tagId));
    const unmappedTriggers = source.triggers.filter(t => !mappedIds.has(t.triggerId));
    const unmappedVars = source.variables.filter(v => !mappedIds.has(v.variableId));

    if (unmappedTags.length > 0) {
      warnings.push(`${unmappedTags.length} source tags were not mapped`);
    }
    if (unmappedTriggers.length > 0) {
      warnings.push(`${unmappedTriggers.length} source triggers were not mapped`);
    }
    if (unmappedVars.length > 0) {
      warnings.push(`${unmappedVars.length} source variables were not mapped`);
    }

    return warnings;
  }

  private extractVariableReferences(tag: GTMTag): string[] {
    const refs: string[] = [];
    const pattern = /\{\{([^}]+)\}\}/g;

    const jsonStr = JSON.stringify(tag.parameter || []);
    let match;
    while ((match = pattern.exec(jsonStr)) !== null) {
      refs.push(match[1]);
    }

    return [...new Set(refs)];
  }

  private extractVariableReferencesFromTrigger(trigger: GTMTrigger): string[] {
    const refs: string[] = [];
    const pattern = /\{\{([^}]+)\}\}/g;

    const parts = [
      trigger.parameter,
      trigger.filter,
      trigger.autoEventFilter,
      trigger.customEventFilter
    ];

    for (const part of parts) {
      if (part) {
        const jsonStr = JSON.stringify(part);
        let match;
        while ((match = pattern.exec(jsonStr)) !== null) {
          refs.push(match[1]);
        }
      }
    }

    return [...new Set(refs)];
  }

  private extractVariableReferencesFromVariable(variable: GTMVariable): string[] {
    const refs: string[] = [];
    const pattern = /\{\{([^}]+)\}\}/g;

    if (variable.parameter) {
      const jsonStr = JSON.stringify(variable.parameter);
      let match;
      while ((match = pattern.exec(jsonStr)) !== null) {
        refs.push(match[1]);
      }
    }

    return [...new Set(refs)];
  }
}

// ==================== Report Formatter ====================

/**
 * 검증 리포트를 텍스트로 포맷
 */
export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('GTM Validation Report');
  lines.push('='.repeat(60));
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push(`Status: ${report.success ? 'PASSED' : 'FAILED'}`);
  lines.push('');

  lines.push('-'.repeat(40));
  lines.push('Summary');
  lines.push('-'.repeat(40));
  lines.push(`Expected entities: ${report.summary.expectedCount}`);
  lines.push(`Actual entities: ${report.summary.actualCount}`);
  lines.push(`Missing: ${report.summary.missingCount}`);
  lines.push(`Broken references: ${report.summary.brokenRefCount}`);
  lines.push('');

  if (report.missing.length > 0) {
    lines.push('-'.repeat(40));
    lines.push('Missing Entities');
    lines.push('-'.repeat(40));
    for (const item of report.missing) {
      lines.push(`  [${item.type}] ${item.name}`);
      if (item.reason) lines.push(`     Reason: ${item.reason}`);
    }
    lines.push('');
  }

  if (report.brokenReferences.length > 0) {
    lines.push('-'.repeat(40));
    lines.push('Broken References');
    lines.push('-'.repeat(40));
    for (const item of report.brokenReferences) {
      lines.push(`  [${item.entityType}] ${item.entityName}`);
      lines.push(`     Missing: ${item.missingTargetName || item.missingTargetId}`);
    }
    lines.push('');
  }

  if (report.warnings.length > 0) {
    lines.push('-'.repeat(40));
    lines.push('Warnings');
    lines.push('-'.repeat(40));
    for (const warning of report.warnings) {
      lines.push(`  ${warning}`);
    }
    lines.push('');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}
