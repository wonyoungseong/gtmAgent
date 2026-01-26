"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationChecker = void 0;
exports.formatValidationReport = formatValidationReport;
const gtm_1 = require("../types/gtm");
const dependency_1 = require("../types/dependency");
// ==================== Validation Checker ====================
class ValidationChecker {
    /**
     * 전체 검증 수행
     */
    validate(input) {
        const { sourceEntities, targetEntities, idMapping, sourceWorkspace, targetWorkspace } = input;
        // 1. 누락 엔티티 확인
        const missing = this.findMissingEntities(sourceEntities, targetEntities, idMapping);
        // 2. 참조 무결성 검사
        const brokenReferences = this.checkReferenceIntegrity(targetEntities);
        // 3. 요약 생성
        const expectedCount = sourceEntities.tags.length +
            sourceEntities.triggers.length +
            sourceEntities.variables.length;
        const actualCount = targetEntities.tags.length +
            targetEntities.triggers.length +
            targetEntities.variables.length;
        const summary = {
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
    checkIntegrity(entities) {
        const issues = [];
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
                        entityType: gtm_1.EntityType.TAG,
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
                        entityType: gtm_1.EntityType.TAG,
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
                        entityType: gtm_1.EntityType.TAG,
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
                        entityType: gtm_1.EntityType.TAG,
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
                        entityType: gtm_1.EntityType.TRIGGER,
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
                        entityType: gtm_1.EntityType.VARIABLE,
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
    preValidate(entitiesToCreate, existingEntities) {
        const conflicts = [];
        const dependencies = [];
        const existingTagNames = new Set(existingEntities.tags.map(t => t.name));
        const existingTriggerNames = new Set(existingEntities.triggers.map(t => t.name));
        const existingVarNames = new Set(existingEntities.variables.map(v => v.name));
        // 이름 충돌 검사
        for (const tag of entitiesToCreate.tags) {
            if (tag.name && existingTagNames.has(tag.name)) {
                conflicts.push({
                    type: gtm_1.EntityType.TAG,
                    name: tag.name,
                    reason: 'Tag with same name already exists'
                });
            }
        }
        for (const trigger of entitiesToCreate.triggers) {
            if (trigger.name && existingTriggerNames.has(trigger.name)) {
                conflicts.push({
                    type: gtm_1.EntityType.TRIGGER,
                    name: trigger.name,
                    reason: 'Trigger with same name already exists'
                });
            }
        }
        for (const variable of entitiesToCreate.variables) {
            if (variable.name && existingVarNames.has(variable.name)) {
                conflicts.push({
                    type: gtm_1.EntityType.VARIABLE,
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
    findMissingEntities(source, target, idMapping) {
        const missing = [];
        // 매핑된 ID 중 Target에 없는 것 찾기
        for (const [originalId, entry] of Object.entries(idMapping)) {
            const newId = entry.newId;
            switch (entry.type) {
                case gtm_1.EntityType.TAG:
                    if (!target.tags.find(t => t.tagId === newId)) {
                        missing.push({
                            type: gtm_1.EntityType.TAG,
                            originalId,
                            name: entry.name,
                            reason: 'Not found in target workspace'
                        });
                    }
                    break;
                case gtm_1.EntityType.TRIGGER:
                    if (!target.triggers.find(t => t.triggerId === newId)) {
                        missing.push({
                            type: gtm_1.EntityType.TRIGGER,
                            originalId,
                            name: entry.name,
                            reason: 'Not found in target workspace'
                        });
                    }
                    break;
                case gtm_1.EntityType.VARIABLE:
                    if (!target.variables.find(v => v.variableId === newId)) {
                        missing.push({
                            type: gtm_1.EntityType.VARIABLE,
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
    checkReferenceIntegrity(entities) {
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
    issueTypeToDepType(issueType) {
        switch (issueType) {
            case 'missing_trigger':
                return dependency_1.DependencyType.FIRING_TRIGGER;
            case 'missing_variable':
                return dependency_1.DependencyType.DIRECT_REFERENCE;
            case 'missing_tag':
                return dependency_1.DependencyType.CONFIG_TAG_REF;
            default:
                return dependency_1.DependencyType.DIRECT_REFERENCE;
        }
    }
    generateWarnings(source, target, idMapping) {
        const warnings = [];
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
    extractVariableReferences(tag) {
        const refs = [];
        const pattern = /\{\{([^}]+)\}\}/g;
        const jsonStr = JSON.stringify(tag.parameter || []);
        let match;
        while ((match = pattern.exec(jsonStr)) !== null) {
            refs.push(match[1]);
        }
        return [...new Set(refs)];
    }
    extractVariableReferencesFromTrigger(trigger) {
        const refs = [];
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
    extractVariableReferencesFromVariable(variable) {
        const refs = [];
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
exports.ValidationChecker = ValidationChecker;
// ==================== Report Formatter ====================
/**
 * 검증 리포트를 텍스트로 포맷
 */
function formatValidationReport(report) {
    const lines = [];
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
            if (item.reason)
                lines.push(`     Reason: ${item.reason}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdmFsaWRhdGlvbi1jaGVja2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXlCRzs7O0FBc2NILHdEQXNEQztBQTFmRCxzQ0FLc0I7QUFDdEIsb0RBTzZCO0FBaUM3QiwrREFBK0Q7QUFFL0QsTUFBYSxpQkFBaUI7SUFDNUI7O09BRUc7SUFDSCxRQUFRLENBQUMsS0FBc0I7UUFDN0IsTUFBTSxFQUNKLGNBQWMsRUFDZCxjQUFjLEVBQ2QsU0FBUyxFQUNULGVBQWUsRUFDZixlQUFlLEVBQ2hCLEdBQUcsS0FBSyxDQUFDO1FBRVYsZUFBZTtRQUNmLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxjQUFjLEVBQUUsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXBGLGVBQWU7UUFDZixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUV0RSxXQUFXO1FBQ1gsTUFBTSxhQUFhLEdBQ2pCLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTTtZQUMxQixjQUFjLENBQUMsUUFBUSxDQUFDLE1BQU07WUFDOUIsY0FBYyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7UUFFbEMsTUFBTSxXQUFXLEdBQ2YsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNO1lBQzFCLGNBQWMsQ0FBQyxRQUFRLENBQUMsTUFBTTtZQUM5QixjQUFjLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUVsQyxNQUFNLE9BQU8sR0FBc0I7WUFDakMsYUFBYTtZQUNiLFdBQVc7WUFDWCxZQUFZLEVBQUUsT0FBTyxDQUFDLE1BQU07WUFDNUIsY0FBYyxFQUFFLGdCQUFnQixDQUFDLE1BQU07U0FDeEMsQ0FBQztRQUVGLFdBQVc7UUFDWCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsZ0JB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LEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdkIsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDM0IsS0FBSyxNQUFNLE9BQU8sSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdEMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDN0IsQ0FBQztRQUNELEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDakIsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRTNCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFZhbGlkYXRpb24gQ2hlY2tlciBTa2lsbFxyXG4gKlxyXG4gKiBHVE0g7JeU7Yuw7YuwIOyDneyEsSDqsrDqs7wg6rKA7KadXHJcbiAqIC0gU291cmNl7JmAIFRhcmdldCDruYTqtZBcclxuICogLSDssLjsobAg66y06rKw7ISxIOqygOyCrFxyXG4gKiAtIOuIhOudvSDsl5Tti7Dti7Ag7YOQ7KeAXHJcbiAqIC0g6rKA7KadIOumrO2PrO2KuCDsg53shLFcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBgdHlwZXNjcmlwdFxyXG4gKiBjb25zdCBjaGVja2VyID0gbmV3IFZhbGlkYXRpb25DaGVja2VyKCk7XHJcbiAqXHJcbiAqIC8vIOyDneyEsSDqsrDqs7wg6rKA7KadXHJcbiAqIGNvbnN0IHJlcG9ydCA9IGNoZWNrZXIudmFsaWRhdGUoe1xyXG4gKiAgIHNvdXJjZUVudGl0aWVzOiB7IHRhZ3M6IFsuLi5dLCB0cmlnZ2VyczogWy4uLl0sIHZhcmlhYmxlczogWy4uLl0gfSxcclxuICogICB0YXJnZXRFbnRpdGllczogeyB0YWdzOiBbLi4uXSwgdHJpZ2dlcnM6IFsuLi5dLCB2YXJpYWJsZXM6IFsuLi5dIH0sXHJcbiAqICAgaWRNYXBwaW5nOiBpZE1hcHBlci5nZXRBbGwoKVxyXG4gKiB9KTtcclxuICpcclxuICogaWYgKCFyZXBvcnQuc3VjY2Vzcykge1xyXG4gKiAgIGNvbnNvbGUubG9nKCdNaXNzaW5nOicsIHJlcG9ydC5taXNzaW5nKTtcclxuICogICBjb25zb2xlLmxvZygnQnJva2VuIHJlZnM6JywgcmVwb3J0LmJyb2tlblJlZmVyZW5jZXMpO1xyXG4gKiB9XHJcbiAqIGBgYFxyXG4gKi9cclxuXHJcbmltcG9ydCB7XHJcbiAgRW50aXR5VHlwZSxcclxuICBHVE1UYWcsXHJcbiAgR1RNVHJpZ2dlcixcclxuICBHVE1WYXJpYWJsZVxyXG59IGZyb20gJy4uL3R5cGVzL2d0bSc7XHJcbmltcG9ydCB7XHJcbiAgVmFsaWRhdGlvblJlcG9ydCxcclxuICBWYWxpZGF0aW9uU3VtbWFyeSxcclxuICBNaXNzaW5nRW50aXR5LFxyXG4gIEJyb2tlblJlZmVyZW5jZSxcclxuICBJZE1hcHBpbmcsXHJcbiAgRGVwZW5kZW5jeVR5cGVcclxufSBmcm9tICcuLi90eXBlcy9kZXBlbmRlbmN5JztcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09IFR5cGVzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRpb25JbnB1dCB7XHJcbiAgc291cmNlRW50aXRpZXM6IHtcclxuICAgIHRhZ3M6IEdUTVRhZ1tdO1xyXG4gICAgdHJpZ2dlcnM6IEdUTVRyaWdnZXJbXTtcclxuICAgIHZhcmlhYmxlczogR1RNVmFyaWFibGVbXTtcclxuICB9O1xyXG4gIHRhcmdldEVudGl0aWVzOiB7XHJcbiAgICB0YWdzOiBHVE1UYWdbXTtcclxuICAgIHRyaWdnZXJzOiBHVE1UcmlnZ2VyW107XHJcbiAgICB2YXJpYWJsZXM6IEdUTVZhcmlhYmxlW107XHJcbiAgfTtcclxuICBpZE1hcHBpbmc6IElkTWFwcGluZztcclxuICBzb3VyY2VXb3Jrc3BhY2U/OiB7IGNvbnRhaW5lcklkOiBzdHJpbmc7IHdvcmtzcGFjZUlkOiBzdHJpbmcgfTtcclxuICB0YXJnZXRXb3Jrc3BhY2U/OiB7IGNvbnRhaW5lcklkOiBzdHJpbmc7IHdvcmtzcGFjZUlkOiBzdHJpbmcgfTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJbnRlZ3JpdHlDaGVja1Jlc3VsdCB7XHJcbiAgdmFsaWQ6IGJvb2xlYW47XHJcbiAgaXNzdWVzOiBJbnRlZ3JpdHlJc3N1ZVtdO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEludGVncml0eUlzc3VlIHtcclxuICBlbnRpdHlUeXBlOiBFbnRpdHlUeXBlO1xyXG4gIGVudGl0eUlkOiBzdHJpbmc7XHJcbiAgZW50aXR5TmFtZTogc3RyaW5nO1xyXG4gIGlzc3VlVHlwZTogJ21pc3NpbmdfdHJpZ2dlcicgfCAnbWlzc2luZ192YXJpYWJsZScgfCAnbWlzc2luZ190YWcnIHwgJ2NpcmN1bGFyX3JlZmVyZW5jZSc7XHJcbiAgZGV0YWlsczogc3RyaW5nO1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBWYWxpZGF0aW9uIENoZWNrZXIgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmV4cG9ydCBjbGFzcyBWYWxpZGF0aW9uQ2hlY2tlciB7XHJcbiAgLyoqXHJcbiAgICog7KCE7LK0IOqygOymnSDsiJjtlolcclxuICAgKi9cclxuICB2YWxpZGF0ZShpbnB1dDogVmFsaWRhdGlvbklucHV0KTogVmFsaWRhdGlvblJlcG9ydCB7XHJcbiAgICBjb25zdCB7XHJcbiAgICAgIHNvdXJjZUVudGl0aWVzLFxyXG4gICAgICB0YXJnZXRFbnRpdGllcyxcclxuICAgICAgaWRNYXBwaW5nLFxyXG4gICAgICBzb3VyY2VXb3Jrc3BhY2UsXHJcbiAgICAgIHRhcmdldFdvcmtzcGFjZVxyXG4gICAgfSA9IGlucHV0O1xyXG5cclxuICAgIC8vIDEuIOuIhOudvSDsl5Tti7Dti7Ag7ZmV7J24XHJcbiAgICBjb25zdCBtaXNzaW5nID0gdGhpcy5maW5kTWlzc2luZ0VudGl0aWVzKHNvdXJjZUVudGl0aWVzLCB0YXJnZXRFbnRpdGllcywgaWRNYXBwaW5nKTtcclxuXHJcbiAgICAvLyAyLiDssLjsobAg66y06rKw7ISxIOqygOyCrFxyXG4gICAgY29uc3QgYnJva2VuUmVmZXJlbmNlcyA9IHRoaXMuY2hlY2tSZWZlcmVuY2VJbnRlZ3JpdHkodGFyZ2V0RW50aXRpZXMpO1xyXG5cclxuICAgIC8vIDMuIOyalOyVvSDsg53shLFcclxuICAgIGNvbnN0IGV4cGVjdGVkQ291bnQgPVxyXG4gICAgICBzb3VyY2VFbnRpdGllcy50YWdzLmxlbmd0aCArXHJcbiAgICAgIHNvdXJjZUVudGl0aWVzLnRyaWdnZXJzLmxlbmd0aCArXHJcbiAgICAgIHNvdXJjZUVudGl0aWVzLnZhcmlhYmxlcy5sZW5ndGg7XHJcblxyXG4gICAgY29uc3QgYWN0dWFsQ291bnQgPVxyXG4gICAgICB0YXJnZXRFbnRpdGllcy50YWdzLmxlbmd0aCArXHJcbiAgICAgIHRhcmdldEVudGl0aWVzLnRyaWdnZXJzLmxlbmd0aCArXHJcbiAgICAgIHRhcmdldEVudGl0aWVzLnZhcmlhYmxlcy5sZW5ndGg7XHJcblxyXG4gICAgY29uc3Qgc3VtbWFyeTogVmFsaWRhdGlvblN1bW1hcnkgPSB7XHJcbiAgICAgIGV4cGVjdGVkQ291bnQsXHJcbiAgICAgIGFjdHVhbENvdW50LFxyXG4gICAgICBtaXNzaW5nQ291bnQ6IG1pc3NpbmcubGVuZ3RoLFxyXG4gICAgICBicm9rZW5SZWZDb3VudDogYnJva2VuUmVmZXJlbmNlcy5sZW5ndGhcclxuICAgIH07XHJcblxyXG4gICAgLy8gNC4g6rK96rOgIOyDneyEsVxyXG4gICAgY29uc3Qgd2FybmluZ3MgPSB0aGlzLmdlbmVyYXRlV2FybmluZ3Moc291cmNlRW50aXRpZXMsIHRhcmdldEVudGl0aWVzLCBpZE1hcHBpbmcpO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN1Y2Nlc3M6IG1pc3NpbmcubGVuZ3RoID09PSAwICYmIGJyb2tlblJlZmVyZW5jZXMubGVuZ3RoID09PSAwLFxyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgc291cmNlOiB7XHJcbiAgICAgICAgY29udGFpbmVySWQ6IHNvdXJjZVdvcmtzcGFjZT8uY29udGFpbmVySWQgfHwgJ3Vua25vd24nLFxyXG4gICAgICAgIHdvcmtzcGFjZUlkOiBzb3VyY2VXb3Jrc3BhY2U/LndvcmtzcGFjZUlkIHx8ICd1bmtub3duJyxcclxuICAgICAgICBlbnRpdHlDb3VudDogZXhwZWN0ZWRDb3VudFxyXG4gICAgICB9LFxyXG4gICAgICB0YXJnZXQ6IHtcclxuICAgICAgICBjb250YWluZXJJZDogdGFyZ2V0V29ya3NwYWNlPy5jb250YWluZXJJZCB8fCAndW5rbm93bicsXHJcbiAgICAgICAgd29ya3NwYWNlSWQ6IHRhcmdldFdvcmtzcGFjZT8ud29ya3NwYWNlSWQgfHwgJ3Vua25vd24nLFxyXG4gICAgICAgIGVudGl0eUNvdW50OiBhY3R1YWxDb3VudFxyXG4gICAgICB9LFxyXG4gICAgICBzdW1tYXJ5LFxyXG4gICAgICBtaXNzaW5nLFxyXG4gICAgICBicm9rZW5SZWZlcmVuY2VzLFxyXG4gICAgICB3YXJuaW5nc1xyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOywuOyhsCDrrLTqsrDshLHrp4wg6rKA7IKsXHJcbiAgICovXHJcbiAgY2hlY2tJbnRlZ3JpdHkoZW50aXRpZXM6IHtcclxuICAgIHRhZ3M6IEdUTVRhZ1tdO1xyXG4gICAgdHJpZ2dlcnM6IEdUTVRyaWdnZXJbXTtcclxuICAgIHZhcmlhYmxlczogR1RNVmFyaWFibGVbXTtcclxuICB9KTogSW50ZWdyaXR5Q2hlY2tSZXN1bHQge1xyXG4gICAgY29uc3QgaXNzdWVzOiBJbnRlZ3JpdHlJc3N1ZVtdID0gW107XHJcblxyXG4gICAgY29uc3QgdHJpZ2dlcklkcyA9IG5ldyBTZXQoZW50aXRpZXMudHJpZ2dlcnMubWFwKHQgPT4gdC50cmlnZ2VySWQpKTtcclxuICAgIGNvbnN0IHZhcmlhYmxlTmFtZXMgPSBuZXcgU2V0KGVudGl0aWVzLnZhcmlhYmxlcy5tYXAodiA9PiB2Lm5hbWUpKTtcclxuICAgIGNvbnN0IHRhZ0lkcyA9IG5ldyBTZXQoZW50aXRpZXMudGFncy5tYXAodCA9PiB0LnRhZ0lkKSk7XHJcbiAgICBjb25zdCB0YWdOYW1lcyA9IG5ldyBTZXQoZW50aXRpZXMudGFncy5tYXAodCA9PiB0Lm5hbWUpKTtcclxuXHJcbiAgICAvLyDtg5zqt7gg6rKA7IKsXHJcbiAgICBmb3IgKGNvbnN0IHRhZyBvZiBlbnRpdGllcy50YWdzKSB7XHJcbiAgICAgIC8vIEZpcmluZyBUcmlnZ2VycyDqsoDsgqxcclxuICAgICAgZm9yIChjb25zdCB0cmlnZ2VySWQgb2YgdGFnLmZpcmluZ1RyaWdnZXJJZCB8fCBbXSkge1xyXG4gICAgICAgIGlmICghdHJpZ2dlcklkcy5oYXModHJpZ2dlcklkKSkge1xyXG4gICAgICAgICAgaXNzdWVzLnB1c2goe1xyXG4gICAgICAgICAgICBlbnRpdHlUeXBlOiBFbnRpdHlUeXBlLlRBRyxcclxuICAgICAgICAgICAgZW50aXR5SWQ6IHRhZy50YWdJZCxcclxuICAgICAgICAgICAgZW50aXR5TmFtZTogdGFnLm5hbWUsXHJcbiAgICAgICAgICAgIGlzc3VlVHlwZTogJ21pc3NpbmdfdHJpZ2dlcicsXHJcbiAgICAgICAgICAgIGRldGFpbHM6IGBGaXJpbmcgdHJpZ2dlciAke3RyaWdnZXJJZH0gbm90IGZvdW5kYFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBCbG9ja2luZyBUcmlnZ2VycyDqsoDsgqxcclxuICAgICAgZm9yIChjb25zdCB0cmlnZ2VySWQgb2YgdGFnLmJsb2NraW5nVHJpZ2dlcklkIHx8IFtdKSB7XHJcbiAgICAgICAgaWYgKCF0cmlnZ2VySWRzLmhhcyh0cmlnZ2VySWQpKSB7XHJcbiAgICAgICAgICBpc3N1ZXMucHVzaCh7XHJcbiAgICAgICAgICAgIGVudGl0eVR5cGU6IEVudGl0eVR5cGUuVEFHLFxyXG4gICAgICAgICAgICBlbnRpdHlJZDogdGFnLnRhZ0lkLFxyXG4gICAgICAgICAgICBlbnRpdHlOYW1lOiB0YWcubmFtZSxcclxuICAgICAgICAgICAgaXNzdWVUeXBlOiAnbWlzc2luZ190cmlnZ2VyJyxcclxuICAgICAgICAgICAgZGV0YWlsczogYEJsb2NraW5nIHRyaWdnZXIgJHt0cmlnZ2VySWR9IG5vdCBmb3VuZGBcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8g67OA7IiYIOywuOyhsCDqsoDsgqxcclxuICAgICAgY29uc3QgdmFyUmVmcyA9IHRoaXMuZXh0cmFjdFZhcmlhYmxlUmVmZXJlbmNlcyh0YWcpO1xyXG4gICAgICBmb3IgKGNvbnN0IHZhck5hbWUgb2YgdmFyUmVmcykge1xyXG4gICAgICAgIGlmICghdmFyaWFibGVOYW1lcy5oYXModmFyTmFtZSkpIHtcclxuICAgICAgICAgIGlzc3Vlcy5wdXNoKHtcclxuICAgICAgICAgICAgZW50aXR5VHlwZTogRW50aXR5VHlwZS5UQUcsXHJcbiAgICAgICAgICAgIGVudGl0eUlkOiB0YWcudGFnSWQsXHJcbiAgICAgICAgICAgIGVudGl0eU5hbWU6IHRhZy5uYW1lLFxyXG4gICAgICAgICAgICBpc3N1ZVR5cGU6ICdtaXNzaW5nX3ZhcmlhYmxlJyxcclxuICAgICAgICAgICAgZGV0YWlsczogYFZhcmlhYmxlIFwiJHt2YXJOYW1lfVwiIG5vdCBmb3VuZGBcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gU2V0dXAvVGVhcmRvd24gVGFncyDqsoDsgqxcclxuICAgICAgZm9yIChjb25zdCBzZXR1cCBvZiB0YWcuc2V0dXBUYWcgfHwgW10pIHtcclxuICAgICAgICBjb25zdCByZWZJZCA9IHNldHVwLnRhZ0lkIHx8IHNldHVwLnRhZ05hbWU7XHJcbiAgICAgICAgY29uc3QgaXNGb3VuZCA9IHNldHVwLnRhZ0lkXHJcbiAgICAgICAgICA/IHRhZ0lkcy5oYXMoc2V0dXAudGFnSWQpXHJcbiAgICAgICAgICA6IChzZXR1cC50YWdOYW1lID8gdGFnTmFtZXMuaGFzKHNldHVwLnRhZ05hbWUpIDogdHJ1ZSk7XHJcbiAgICAgICAgaWYgKCFpc0ZvdW5kICYmIHJlZklkKSB7XHJcbiAgICAgICAgICBpc3N1ZXMucHVzaCh7XHJcbiAgICAgICAgICAgIGVudGl0eVR5cGU6IEVudGl0eVR5cGUuVEFHLFxyXG4gICAgICAgICAgICBlbnRpdHlJZDogdGFnLnRhZ0lkLFxyXG4gICAgICAgICAgICBlbnRpdHlOYW1lOiB0YWcubmFtZSxcclxuICAgICAgICAgICAgaXNzdWVUeXBlOiAnbWlzc2luZ190YWcnLFxyXG4gICAgICAgICAgICBkZXRhaWxzOiBgU2V0dXAgdGFnICR7cmVmSWR9IG5vdCBmb3VuZGBcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIO2KuOumrOqxsCDqsoDsgqxcclxuICAgIGZvciAoY29uc3QgdHJpZ2dlciBvZiBlbnRpdGllcy50cmlnZ2Vycykge1xyXG4gICAgICBjb25zdCB2YXJSZWZzID0gdGhpcy5leHRyYWN0VmFyaWFibGVSZWZlcmVuY2VzRnJvbVRyaWdnZXIodHJpZ2dlcik7XHJcbiAgICAgIGZvciAoY29uc3QgdmFyTmFtZSBvZiB2YXJSZWZzKSB7XHJcbiAgICAgICAgaWYgKCF2YXJpYWJsZU5hbWVzLmhhcyh2YXJOYW1lKSkge1xyXG4gICAgICAgICAgaXNzdWVzLnB1c2goe1xyXG4gICAgICAgICAgICBlbnRpdHlUeXBlOiBFbnRpdHlUeXBlLlRSSUdHRVIsXHJcbiAgICAgICAgICAgIGVudGl0eUlkOiB0cmlnZ2VyLnRyaWdnZXJJZCxcclxuICAgICAgICAgICAgZW50aXR5TmFtZTogdHJpZ2dlci5uYW1lLFxyXG4gICAgICAgICAgICBpc3N1ZVR5cGU6ICdtaXNzaW5nX3ZhcmlhYmxlJyxcclxuICAgICAgICAgICAgZGV0YWlsczogYFZhcmlhYmxlIFwiJHt2YXJOYW1lfVwiIG5vdCBmb3VuZGBcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIOuzgOyImCDqsoDsgqwgKOuLpOuluCDrs4DsiJgg7LC47KGwKVxyXG4gICAgZm9yIChjb25zdCB2YXJpYWJsZSBvZiBlbnRpdGllcy52YXJpYWJsZXMpIHtcclxuICAgICAgY29uc3QgdmFyUmVmcyA9IHRoaXMuZXh0cmFjdFZhcmlhYmxlUmVmZXJlbmNlc0Zyb21WYXJpYWJsZSh2YXJpYWJsZSk7XHJcbiAgICAgIGZvciAoY29uc3QgdmFyTmFtZSBvZiB2YXJSZWZzKSB7XHJcbiAgICAgICAgaWYgKCF2YXJpYWJsZU5hbWVzLmhhcyh2YXJOYW1lKSAmJiB2YXJOYW1lICE9PSB2YXJpYWJsZS5uYW1lKSB7XHJcbiAgICAgICAgICBpc3N1ZXMucHVzaCh7XHJcbiAgICAgICAgICAgIGVudGl0eVR5cGU6IEVudGl0eVR5cGUuVkFSSUFCTEUsXHJcbiAgICAgICAgICAgIGVudGl0eUlkOiB2YXJpYWJsZS52YXJpYWJsZUlkLFxyXG4gICAgICAgICAgICBlbnRpdHlOYW1lOiB2YXJpYWJsZS5uYW1lLFxyXG4gICAgICAgICAgICBpc3N1ZVR5cGU6ICdtaXNzaW5nX3ZhcmlhYmxlJyxcclxuICAgICAgICAgICAgZGV0YWlsczogYFZhcmlhYmxlIFwiJHt2YXJOYW1lfVwiIG5vdCBmb3VuZGBcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHZhbGlkOiBpc3N1ZXMubGVuZ3RoID09PSAwLFxyXG4gICAgICBpc3N1ZXNcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDsg53shLEg7KCEIOyCrOyghCDqsoDspp1cclxuICAgKi9cclxuICBwcmVWYWxpZGF0ZShcclxuICAgIGVudGl0aWVzVG9DcmVhdGU6IHtcclxuICAgICAgdGFnczogUGFydGlhbDxHVE1UYWc+W107XHJcbiAgICAgIHRyaWdnZXJzOiBQYXJ0aWFsPEdUTVRyaWdnZXI+W107XHJcbiAgICAgIHZhcmlhYmxlczogUGFydGlhbDxHVE1WYXJpYWJsZT5bXTtcclxuICAgIH0sXHJcbiAgICBleGlzdGluZ0VudGl0aWVzOiB7XHJcbiAgICAgIHRhZ3M6IEdUTVRhZ1tdO1xyXG4gICAgICB0cmlnZ2VyczogR1RNVHJpZ2dlcltdO1xyXG4gICAgICB2YXJpYWJsZXM6IEdUTVZhcmlhYmxlW107XHJcbiAgICB9XHJcbiAgKToge1xyXG4gICAgY2FuQ3JlYXRlOiBib29sZWFuO1xyXG4gICAgY29uZmxpY3RzOiBBcnJheTx7IHR5cGU6IEVudGl0eVR5cGU7IG5hbWU6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT47XHJcbiAgICBkZXBlbmRlbmNpZXM6IEFycmF5PHsgdHlwZTogRW50aXR5VHlwZTsgbmFtZTogc3RyaW5nOyBtaXNzaW5nOiBzdHJpbmdbXSB9PjtcclxuICB9IHtcclxuICAgIGNvbnN0IGNvbmZsaWN0czogQXJyYXk8eyB0eXBlOiBFbnRpdHlUeXBlOyBuYW1lOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+ID0gW107XHJcbiAgICBjb25zdCBkZXBlbmRlbmNpZXM6IEFycmF5PHsgdHlwZTogRW50aXR5VHlwZTsgbmFtZTogc3RyaW5nOyBtaXNzaW5nOiBzdHJpbmdbXSB9PiA9IFtdO1xyXG5cclxuICAgIGNvbnN0IGV4aXN0aW5nVGFnTmFtZXMgPSBuZXcgU2V0KGV4aXN0aW5nRW50aXRpZXMudGFncy5tYXAodCA9PiB0Lm5hbWUpKTtcclxuICAgIGNvbnN0IGV4aXN0aW5nVHJpZ2dlck5hbWVzID0gbmV3IFNldChleGlzdGluZ0VudGl0aWVzLnRyaWdnZXJzLm1hcCh0ID0+IHQubmFtZSkpO1xyXG4gICAgY29uc3QgZXhpc3RpbmdWYXJOYW1lcyA9IG5ldyBTZXQoZXhpc3RpbmdFbnRpdGllcy52YXJpYWJsZXMubWFwKHYgPT4gdi5uYW1lKSk7XHJcblxyXG4gICAgLy8g7J2066aEIOy2qeuPjCDqsoDsgqxcclxuICAgIGZvciAoY29uc3QgdGFnIG9mIGVudGl0aWVzVG9DcmVhdGUudGFncykge1xyXG4gICAgICBpZiAodGFnLm5hbWUgJiYgZXhpc3RpbmdUYWdOYW1lcy5oYXModGFnLm5hbWUpKSB7XHJcbiAgICAgICAgY29uZmxpY3RzLnB1c2goe1xyXG4gICAgICAgICAgdHlwZTogRW50aXR5VHlwZS5UQUcsXHJcbiAgICAgICAgICBuYW1lOiB0YWcubmFtZSxcclxuICAgICAgICAgIHJlYXNvbjogJ1RhZyB3aXRoIHNhbWUgbmFtZSBhbHJlYWR5IGV4aXN0cydcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAoY29uc3QgdHJpZ2dlciBvZiBlbnRpdGllc1RvQ3JlYXRlLnRyaWdnZXJzKSB7XHJcbiAgICAgIGlmICh0cmlnZ2VyLm5hbWUgJiYgZXhpc3RpbmdUcmlnZ2VyTmFtZXMuaGFzKHRyaWdnZXIubmFtZSkpIHtcclxuICAgICAgICBjb25mbGljdHMucHVzaCh7XHJcbiAgICAgICAgICB0eXBlOiBFbnRpdHlUeXBlLlRSSUdHRVIsXHJcbiAgICAgICAgICBuYW1lOiB0cmlnZ2VyLm5hbWUsXHJcbiAgICAgICAgICByZWFzb246ICdUcmlnZ2VyIHdpdGggc2FtZSBuYW1lIGFscmVhZHkgZXhpc3RzJ1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChjb25zdCB2YXJpYWJsZSBvZiBlbnRpdGllc1RvQ3JlYXRlLnZhcmlhYmxlcykge1xyXG4gICAgICBpZiAodmFyaWFibGUubmFtZSAmJiBleGlzdGluZ1Zhck5hbWVzLmhhcyh2YXJpYWJsZS5uYW1lKSkge1xyXG4gICAgICAgIGNvbmZsaWN0cy5wdXNoKHtcclxuICAgICAgICAgIHR5cGU6IEVudGl0eVR5cGUuVkFSSUFCTEUsXHJcbiAgICAgICAgICBuYW1lOiB2YXJpYWJsZS5uYW1lLFxyXG4gICAgICAgICAgcmVhc29uOiAnVmFyaWFibGUgd2l0aCBzYW1lIG5hbWUgYWxyZWFkeSBleGlzdHMnXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBjYW5DcmVhdGU6IGNvbmZsaWN0cy5sZW5ndGggPT09IDAgJiYgZGVwZW5kZW5jaWVzLmV2ZXJ5KGQgPT4gZC5taXNzaW5nLmxlbmd0aCA9PT0gMCksXHJcbiAgICAgIGNvbmZsaWN0cyxcclxuICAgICAgZGVwZW5kZW5jaWVzXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gUHJpdmF0ZSBNZXRob2RzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIHByaXZhdGUgZmluZE1pc3NpbmdFbnRpdGllcyhcclxuICAgIHNvdXJjZTogeyB0YWdzOiBHVE1UYWdbXTsgdHJpZ2dlcnM6IEdUTVRyaWdnZXJbXTsgdmFyaWFibGVzOiBHVE1WYXJpYWJsZVtdIH0sXHJcbiAgICB0YXJnZXQ6IHsgdGFnczogR1RNVGFnW107IHRyaWdnZXJzOiBHVE1UcmlnZ2VyW107IHZhcmlhYmxlczogR1RNVmFyaWFibGVbXSB9LFxyXG4gICAgaWRNYXBwaW5nOiBJZE1hcHBpbmdcclxuICApOiBNaXNzaW5nRW50aXR5W10ge1xyXG4gICAgY29uc3QgbWlzc2luZzogTWlzc2luZ0VudGl0eVtdID0gW107XHJcblxyXG4gICAgLy8g66ek7ZWR65CcIElEIOykkSBUYXJnZXTsl5Ag7JeG64qUIOqygyDssL7quLBcclxuICAgIGZvciAoY29uc3QgW29yaWdpbmFsSWQsIGVudHJ5XSBvZiBPYmplY3QuZW50cmllcyhpZE1hcHBpbmcpKSB7XHJcbiAgICAgIGNvbnN0IG5ld0lkID0gZW50cnkubmV3SWQ7XHJcblxyXG4gICAgICBzd2l0Y2ggKGVudHJ5LnR5cGUpIHtcclxuICAgICAgICBjYXNlIEVudGl0eVR5cGUuVEFHOlxyXG4gICAgICAgICAgaWYgKCF0YXJnZXQudGFncy5maW5kKHQgPT4gdC50YWdJZCA9PT0gbmV3SWQpKSB7XHJcbiAgICAgICAgICAgIG1pc3NpbmcucHVzaCh7XHJcbiAgICAgICAgICAgICAgdHlwZTogRW50aXR5VHlwZS5UQUcsXHJcbiAgICAgICAgICAgICAgb3JpZ2luYWxJZCxcclxuICAgICAgICAgICAgICBuYW1lOiBlbnRyeS5uYW1lLFxyXG4gICAgICAgICAgICAgIHJlYXNvbjogJ05vdCBmb3VuZCBpbiB0YXJnZXQgd29ya3NwYWNlJ1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICBjYXNlIEVudGl0eVR5cGUuVFJJR0dFUjpcclxuICAgICAgICAgIGlmICghdGFyZ2V0LnRyaWdnZXJzLmZpbmQodCA9PiB0LnRyaWdnZXJJZCA9PT0gbmV3SWQpKSB7XHJcbiAgICAgICAgICAgIG1pc3NpbmcucHVzaCh7XHJcbiAgICAgICAgICAgICAgdHlwZTogRW50aXR5VHlwZS5UUklHR0VSLFxyXG4gICAgICAgICAgICAgIG9yaWdpbmFsSWQsXHJcbiAgICAgICAgICAgICAgbmFtZTogZW50cnkubmFtZSxcclxuICAgICAgICAgICAgICByZWFzb246ICdOb3QgZm91bmQgaW4gdGFyZ2V0IHdvcmtzcGFjZSdcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgY2FzZSBFbnRpdHlUeXBlLlZBUklBQkxFOlxyXG4gICAgICAgICAgaWYgKCF0YXJnZXQudmFyaWFibGVzLmZpbmQodiA9PiB2LnZhcmlhYmxlSWQgPT09IG5ld0lkKSkge1xyXG4gICAgICAgICAgICBtaXNzaW5nLnB1c2goe1xyXG4gICAgICAgICAgICAgIHR5cGU6IEVudGl0eVR5cGUuVkFSSUFCTEUsXHJcbiAgICAgICAgICAgICAgb3JpZ2luYWxJZCxcclxuICAgICAgICAgICAgICBuYW1lOiBlbnRyeS5uYW1lLFxyXG4gICAgICAgICAgICAgIHJlYXNvbjogJ05vdCBmb3VuZCBpbiB0YXJnZXQgd29ya3NwYWNlJ1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG1pc3Npbmc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrUmVmZXJlbmNlSW50ZWdyaXR5KGVudGl0aWVzOiB7XHJcbiAgICB0YWdzOiBHVE1UYWdbXTtcclxuICAgIHRyaWdnZXJzOiBHVE1UcmlnZ2VyW107XHJcbiAgICB2YXJpYWJsZXM6IEdUTVZhcmlhYmxlW107XHJcbiAgfSk6IEJyb2tlblJlZmVyZW5jZVtdIHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuY2hlY2tJbnRlZ3JpdHkoZW50aXRpZXMpO1xyXG5cclxuICAgIHJldHVybiByZXN1bHQuaXNzdWVzLm1hcChpc3N1ZSA9PiAoe1xyXG4gICAgICBlbnRpdHlUeXBlOiBpc3N1ZS5lbnRpdHlUeXBlLFxyXG4gICAgICBlbnRpdHlJZDogaXNzdWUuZW50aXR5SWQsXHJcbiAgICAgIGVudGl0eU5hbWU6IGlzc3VlLmVudGl0eU5hbWUsXHJcbiAgICAgIHJlZmVyZW5jZVR5cGU6IHRoaXMuaXNzdWVUeXBlVG9EZXBUeXBlKGlzc3VlLmlzc3VlVHlwZSksXHJcbiAgICAgIG1pc3NpbmdUYXJnZXRJZDogaXNzdWUuZGV0YWlscy5zcGxpdCgnICcpWzFdIHx8ICd1bmtub3duJyxcclxuICAgICAgbWlzc2luZ1RhcmdldE5hbWU6IGlzc3VlLmRldGFpbHNcclxuICAgIH0pKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaXNzdWVUeXBlVG9EZXBUeXBlKGlzc3VlVHlwZTogc3RyaW5nKTogRGVwZW5kZW5jeVR5cGUge1xyXG4gICAgc3dpdGNoIChpc3N1ZVR5cGUpIHtcclxuICAgICAgY2FzZSAnbWlzc2luZ190cmlnZ2VyJzpcclxuICAgICAgICByZXR1cm4gRGVwZW5kZW5jeVR5cGUuRklSSU5HX1RSSUdHRVI7XHJcbiAgICAgIGNhc2UgJ21pc3NpbmdfdmFyaWFibGUnOlxyXG4gICAgICAgIHJldHVybiBEZXBlbmRlbmN5VHlwZS5ESVJFQ1RfUkVGRVJFTkNFO1xyXG4gICAgICBjYXNlICdtaXNzaW5nX3RhZyc6XHJcbiAgICAgICAgcmV0dXJuIERlcGVuZGVuY3lUeXBlLkNPTkZJR19UQUdfUkVGO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiBEZXBlbmRlbmN5VHlwZS5ESVJFQ1RfUkVGRVJFTkNFO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZW5lcmF0ZVdhcm5pbmdzKFxyXG4gICAgc291cmNlOiB7IHRhZ3M6IEdUTVRhZ1tdOyB0cmlnZ2VyczogR1RNVHJpZ2dlcltdOyB2YXJpYWJsZXM6IEdUTVZhcmlhYmxlW10gfSxcclxuICAgIHRhcmdldDogeyB0YWdzOiBHVE1UYWdbXTsgdHJpZ2dlcnM6IEdUTVRyaWdnZXJbXTsgdmFyaWFibGVzOiBHVE1WYXJpYWJsZVtdIH0sXHJcbiAgICBpZE1hcHBpbmc6IElkTWFwcGluZ1xyXG4gICk6IHN0cmluZ1tdIHtcclxuICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICAgIC8vIOunpO2VkeuQmOyngCDslYrsnYAgU291cmNlIOyXlO2LsO2LsFxyXG4gICAgY29uc3QgbWFwcGVkSWRzID0gbmV3IFNldChPYmplY3Qua2V5cyhpZE1hcHBpbmcpKTtcclxuXHJcbiAgICBjb25zdCB1bm1hcHBlZFRhZ3MgPSBzb3VyY2UudGFncy5maWx0ZXIodCA9PiAhbWFwcGVkSWRzLmhhcyh0LnRhZ0lkKSk7XHJcbiAgICBjb25zdCB1bm1hcHBlZFRyaWdnZXJzID0gc291cmNlLnRyaWdnZXJzLmZpbHRlcih0ID0+ICFtYXBwZWRJZHMuaGFzKHQudHJpZ2dlcklkKSk7XHJcbiAgICBjb25zdCB1bm1hcHBlZFZhcnMgPSBzb3VyY2UudmFyaWFibGVzLmZpbHRlcih2ID0+ICFtYXBwZWRJZHMuaGFzKHYudmFyaWFibGVJZCkpO1xyXG5cclxuICAgIGlmICh1bm1hcHBlZFRhZ3MubGVuZ3RoID4gMCkge1xyXG4gICAgICB3YXJuaW5ncy5wdXNoKGAke3VubWFwcGVkVGFncy5sZW5ndGh9IHNvdXJjZSB0YWdzIHdlcmUgbm90IG1hcHBlZGApO1xyXG4gICAgfVxyXG4gICAgaWYgKHVubWFwcGVkVHJpZ2dlcnMubGVuZ3RoID4gMCkge1xyXG4gICAgICB3YXJuaW5ncy5wdXNoKGAke3VubWFwcGVkVHJpZ2dlcnMubGVuZ3RofSBzb3VyY2UgdHJpZ2dlcnMgd2VyZSBub3QgbWFwcGVkYCk7XHJcbiAgICB9XHJcbiAgICBpZiAodW5tYXBwZWRWYXJzLmxlbmd0aCA+IDApIHtcclxuICAgICAgd2FybmluZ3MucHVzaChgJHt1bm1hcHBlZFZhcnMubGVuZ3RofSBzb3VyY2UgdmFyaWFibGVzIHdlcmUgbm90IG1hcHBlZGApO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB3YXJuaW5ncztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZXh0cmFjdFZhcmlhYmxlUmVmZXJlbmNlcyh0YWc6IEdUTVRhZyk6IHN0cmluZ1tdIHtcclxuICAgIGNvbnN0IHJlZnM6IHN0cmluZ1tdID0gW107XHJcbiAgICBjb25zdCBwYXR0ZXJuID0gL1xce1xceyhbXn1dKylcXH1cXH0vZztcclxuXHJcbiAgICBjb25zdCBqc29uU3RyID0gSlNPTi5zdHJpbmdpZnkodGFnLnBhcmFtZXRlciB8fCBbXSk7XHJcbiAgICBsZXQgbWF0Y2g7XHJcbiAgICB3aGlsZSAoKG1hdGNoID0gcGF0dGVybi5leGVjKGpzb25TdHIpKSAhPT0gbnVsbCkge1xyXG4gICAgICByZWZzLnB1c2gobWF0Y2hbMV0pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBbLi4ubmV3IFNldChyZWZzKV07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGV4dHJhY3RWYXJpYWJsZVJlZmVyZW5jZXNGcm9tVHJpZ2dlcih0cmlnZ2VyOiBHVE1UcmlnZ2VyKTogc3RyaW5nW10ge1xyXG4gICAgY29uc3QgcmVmczogc3RyaW5nW10gPSBbXTtcclxuICAgIGNvbnN0IHBhdHRlcm4gPSAvXFx7XFx7KFtefV0rKVxcfVxcfS9nO1xyXG5cclxuICAgIGNvbnN0IHBhcnRzID0gW1xyXG4gICAgICB0cmlnZ2VyLnBhcmFtZXRlcixcclxuICAgICAgdHJpZ2dlci5maWx0ZXIsXHJcbiAgICAgIHRyaWdnZXIuYXV0b0V2ZW50RmlsdGVyLFxyXG4gICAgICB0cmlnZ2VyLmN1c3RvbUV2ZW50RmlsdGVyXHJcbiAgICBdO1xyXG5cclxuICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xyXG4gICAgICBpZiAocGFydCkge1xyXG4gICAgICAgIGNvbnN0IGpzb25TdHIgPSBKU09OLnN0cmluZ2lmeShwYXJ0KTtcclxuICAgICAgICBsZXQgbWF0Y2g7XHJcbiAgICAgICAgd2hpbGUgKChtYXRjaCA9IHBhdHRlcm4uZXhlYyhqc29uU3RyKSkgIT09IG51bGwpIHtcclxuICAgICAgICAgIHJlZnMucHVzaChtYXRjaFsxXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIFsuLi5uZXcgU2V0KHJlZnMpXTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZXh0cmFjdFZhcmlhYmxlUmVmZXJlbmNlc0Zyb21WYXJpYWJsZSh2YXJpYWJsZTogR1RNVmFyaWFibGUpOiBzdHJpbmdbXSB7XHJcbiAgICBjb25zdCByZWZzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgY29uc3QgcGF0dGVybiA9IC9cXHtcXHsoW159XSspXFx9XFx9L2c7XHJcblxyXG4gICAgaWYgKHZhcmlhYmxlLnBhcmFtZXRlcikge1xyXG4gICAgICBjb25zdCBqc29uU3RyID0gSlNPTi5zdHJpbmdpZnkodmFyaWFibGUucGFyYW1ldGVyKTtcclxuICAgICAgbGV0IG1hdGNoO1xyXG4gICAgICB3aGlsZSAoKG1hdGNoID0gcGF0dGVybi5leGVjKGpzb25TdHIpKSAhPT0gbnVsbCkge1xyXG4gICAgICAgIHJlZnMucHVzaChtYXRjaFsxXSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gWy4uLm5ldyBTZXQocmVmcyldO1xyXG4gIH1cclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT0gUmVwb3J0IEZvcm1hdHRlciA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIOqygOymnSDrpqztj6ztirjrpbwg7YWN7Iqk7Yq466GcIO2PrOunt1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFZhbGlkYXRpb25SZXBvcnQocmVwb3J0OiBWYWxpZGF0aW9uUmVwb3J0KTogc3RyaW5nIHtcclxuICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgbGluZXMucHVzaCgnPScucmVwZWF0KDYwKSk7XHJcbiAgbGluZXMucHVzaCgnR1RNIFZhbGlkYXRpb24gUmVwb3J0Jyk7XHJcbiAgbGluZXMucHVzaCgnPScucmVwZWF0KDYwKSk7XHJcbiAgbGluZXMucHVzaChgVGltZXN0YW1wOiAke3JlcG9ydC50aW1lc3RhbXB9YCk7XHJcbiAgbGluZXMucHVzaChgU3RhdHVzOiAke3JlcG9ydC5zdWNjZXNzID8gJ1BBU1NFRCcgOiAnRkFJTEVEJ31gKTtcclxuICBsaW5lcy5wdXNoKCcnKTtcclxuXHJcbiAgbGluZXMucHVzaCgnLScucmVwZWF0KDQwKSk7XHJcbiAgbGluZXMucHVzaCgnU3VtbWFyeScpO1xyXG4gIGxpbmVzLnB1c2goJy0nLnJlcGVhdCg0MCkpO1xyXG4gIGxpbmVzLnB1c2goYEV4cGVjdGVkIGVudGl0aWVzOiAke3JlcG9ydC5zdW1tYXJ5LmV4cGVjdGVkQ291bnR9YCk7XHJcbiAgbGluZXMucHVzaChgQWN0dWFsIGVudGl0aWVzOiAke3JlcG9ydC5zdW1tYXJ5LmFjdHVhbENvdW50fWApO1xyXG4gIGxpbmVzLnB1c2goYE1pc3Npbmc6ICR7cmVwb3J0LnN1bW1hcnkubWlzc2luZ0NvdW50fWApO1xyXG4gIGxpbmVzLnB1c2goYEJyb2tlbiByZWZlcmVuY2VzOiAke3JlcG9ydC5zdW1tYXJ5LmJyb2tlblJlZkNvdW50fWApO1xyXG4gIGxpbmVzLnB1c2goJycpO1xyXG5cclxuICBpZiAocmVwb3J0Lm1pc3NpbmcubGVuZ3RoID4gMCkge1xyXG4gICAgbGluZXMucHVzaCgnLScucmVwZWF0KDQwKSk7XHJcbiAgICBsaW5lcy5wdXNoKCdNaXNzaW5nIEVudGl0aWVzJyk7XHJcbiAgICBsaW5lcy5wdXNoKCctJy5yZXBlYXQoNDApKTtcclxuICAgIGZvciAoY29uc3QgaXRlbSBvZiByZXBvcnQubWlzc2luZykge1xyXG4gICAgICBsaW5lcy5wdXNoKGAgIFske2l0ZW0udHlwZX1dICR7aXRlbS5uYW1lfWApO1xyXG4gICAgICBpZiAoaXRlbS5yZWFzb24pIGxpbmVzLnB1c2goYCAgICAgUmVhc29uOiAke2l0ZW0ucmVhc29ufWApO1xyXG4gICAgfVxyXG4gICAgbGluZXMucHVzaCgnJyk7XHJcbiAgfVxyXG5cclxuICBpZiAocmVwb3J0LmJyb2tlblJlZmVyZW5jZXMubGVuZ3RoID4gMCkge1xyXG4gICAgbGluZXMucHVzaCgnLScucmVwZWF0KDQwKSk7XHJcbiAgICBsaW5lcy5wdXNoKCdCcm9rZW4gUmVmZXJlbmNlcycpO1xyXG4gICAgbGluZXMucHVzaCgnLScucmVwZWF0KDQwKSk7XHJcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcmVwb3J0LmJyb2tlblJlZmVyZW5jZXMpIHtcclxuICAgICAgbGluZXMucHVzaChgICBbJHtpdGVtLmVudGl0eVR5cGV9XSAke2l0ZW0uZW50aXR5TmFtZX1gKTtcclxuICAgICAgbGluZXMucHVzaChgICAgICBNaXNzaW5nOiAke2l0ZW0ubWlzc2luZ1RhcmdldE5hbWUgfHwgaXRlbS5taXNzaW5nVGFyZ2V0SWR9YCk7XHJcbiAgICB9XHJcbiAgICBsaW5lcy5wdXNoKCcnKTtcclxuICB9XHJcblxyXG4gIGlmIChyZXBvcnQud2FybmluZ3MubGVuZ3RoID4gMCkge1xyXG4gICAgbGluZXMucHVzaCgnLScucmVwZWF0KDQwKSk7XHJcbiAgICBsaW5lcy5wdXNoKCdXYXJuaW5ncycpO1xyXG4gICAgbGluZXMucHVzaCgnLScucmVwZWF0KDQwKSk7XHJcbiAgICBmb3IgKGNvbnN0IHdhcm5pbmcgb2YgcmVwb3J0Lndhcm5pbmdzKSB7XHJcbiAgICAgIGxpbmVzLnB1c2goYCAgJHt3YXJuaW5nfWApO1xyXG4gICAgfVxyXG4gICAgbGluZXMucHVzaCgnJyk7XHJcbiAgfVxyXG5cclxuICBsaW5lcy5wdXNoKCc9Jy5yZXBlYXQoNjApKTtcclxuXHJcbiAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xyXG59XHJcbiJdfQ==