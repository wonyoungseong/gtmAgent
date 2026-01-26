"use strict";
/**
 * Validator Agent
 * 엔티티 생성 결과 검증
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatorAgent = void 0;
const gtm_agent_skills_1 = require("gtm-agent-skills");
const base_1 = require("./base");
// ==================== Validator Agent ====================
class ValidatorAgent extends base_1.BaseAgent {
    constructor() {
        super('validator');
        this.checker = new gtm_agent_skills_1.ValidationChecker();
    }
    /**
     * 요청 처리
     */
    async execute(request) {
        this.validateContext();
        switch (request.action) {
            case 'validate':
                return this.validate(request.data);
            case 'preValidate':
                return this.preValidate(request.data);
            case 'checkIntegrity':
                return this.checkIntegrity();
            default:
                throw new Error(`Unknown action: ${request.action}`);
        }
    }
    /**
     * 생성 결과 검증
     */
    async validate(request) {
        return this.safeExecute({ action: 'validate', data: request, context: this.context }, async () => {
            this.logger.info('Starting validation');
            // 1. Target 워크스페이스 엔티티 조회
            this.reportProgress(1, 3, 'Fetching target entities');
            const [targetTags, targetTriggers, targetVariables] = await Promise.all([
                this.mcp.listTags({ refresh: true }),
                this.mcp.listTriggers({ refresh: true }),
                this.mcp.listVariables({ refresh: true })
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
                    containerId: this.context.targetWorkspace.containerId,
                    workspaceId: this.context.targetWorkspace.workspaceId
                }
            });
            this.reportProgress(3, 3, 'Validation completed');
            // 3. 결과 로깅
            if (report.success) {
                this.logger.info('Validation passed', report.summary);
            }
            else {
                this.logger.warn('Validation failed', {
                    missing: report.missing.length,
                    brokenRefs: report.brokenReferences.length,
                    warnings: report.warnings.length
                });
            }
            return report;
        });
    }
    /**
     * 사전 검증 (생성 전)
     */
    async preValidate(request) {
        return this.safeExecute({ action: 'preValidate', data: request, context: this.context }, async () => {
            this.logger.info('Starting pre-validation');
            // 기존 엔티티 조회
            const [existingTags, existingTriggers, existingVariables] = await Promise.all([
                this.mcp.listTags(),
                this.mcp.listTriggers(),
                this.mcp.listVariables()
            ]);
            // 사전 검증 수행
            const result = this.checker.preValidate(request.entitiesToCreate, {
                tags: existingTags,
                triggers: existingTriggers,
                variables: existingVariables
            });
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
        });
    }
    /**
     * 참조 무결성 검사
     */
    async checkIntegrity() {
        return this.safeExecute({ action: 'checkIntegrity', data: {}, context: this.context }, async () => {
            this.logger.info('Checking reference integrity');
            // 모든 엔티티 조회
            const [tags, triggers, variables] = await Promise.all([
                this.mcp.listTags({ refresh: true }),
                this.mcp.listTriggers({ refresh: true }),
                this.mcp.listVariables({ refresh: true })
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
        });
    }
    /**
     * 검증 리포트 포맷팅
     */
    formatReport(report) {
        return (0, gtm_agent_skills_1.formatValidationReport)(report);
    }
}
exports.ValidatorAgent = ValidatorAgent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2FnZW50cy92YWxpZGF0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7O0FBRUgsdURBUTBCO0FBQzFCLGlDQUFtQztBQTZCbkMsNERBQTREO0FBRTVELE1BQWEsY0FBZSxTQUFRLGdCQUFTO0lBRzNDO1FBQ0UsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxvQ0FBaUIsRUFBRSxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxPQUFPLENBQU8sT0FBd0I7UUFDMUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRXZCLFFBQVEsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3ZCLEtBQUssVUFBVTtnQkFDYixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQXVCLENBQThCLENBQUM7WUFFckYsS0FBSyxhQUFhO2dCQUNoQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQTBCLENBQThCLENBQUM7WUFFM0YsS0FBSyxnQkFBZ0I7Z0JBQ25CLE9BQU8sSUFBSSxDQUFDLGNBQWMsRUFBK0IsQ0FBQztZQUU1RDtnQkFDRSxNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUN6RCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLFFBQVEsQ0FDcEIsT0FBd0I7UUFFeEIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUNyQixFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQVEsRUFBRSxFQUM3RCxLQUFLLElBQUksRUFBRTtZQUNULElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxD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LElBQUksQ0FBQyxHQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO2dCQUN6QyxJQUFJLENBQUMsR0FBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQzthQUMzQyxDQUFDLENBQUM7WUFFSCxTQUFTO1lBQ1QsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFFMUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsMkJBQTJCLEVBQUU7Z0JBQzVDLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSztnQkFDbkIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTTthQUM3QixDQUFDLENBQUM7WUFFSCxPQUFPO2dCQUNMLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSztnQkFDbkIsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDOUIsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVO29CQUN4QixVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVU7b0JBQ3hCLFNBQVMsRUFBRSxDQUFDLENBQUMsU0FBUztvQkFDdEIsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPO2lCQUNuQixDQUFDLENBQUM7YUFDSixDQUFDO1FBQ0osQ0FBQyxDQUNGLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxZQUFZLENBQUMsTUFBd0I7UUFDbkMsT0FBTyxJQUFBLHlDQUFzQixFQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3hDLENBQUM7Q0FDRjtBQXZMRCx3Q0F1TEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogVmFsaWRhdG9yIEFnZW50XHJcbiAqIOyXlO2LsO2LsCDsg53shLEg6rKw6rO8IOqygOymnVxyXG4gKi9cclxuXHJcbmltcG9ydCB7XHJcbiAgVmFsaWRhdGlvbkNoZWNrZXIsXHJcbiAgZm9ybWF0VmFsaWRhdGlvblJlcG9ydCxcclxuICBWYWxpZGF0aW9uUmVwb3J0LFxyXG4gIElkTWFwcGluZyxcclxuICBHVE1UYWcsXHJcbiAgR1RNVHJpZ2dlcixcclxuICBHVE1WYXJpYWJsZVxyXG59IGZyb20gJ2d0bS1hZ2VudC1za2lsbHMnO1xyXG5pbXBvcnQgeyBCYXNlQWdlbnQgfSBmcm9tICcuL2Jhc2UnO1xyXG5pbXBvcnQgeyBBZ2VudFJlcXVlc3QsIEFnZW50UmVzcG9uc2UgfSBmcm9tICcuLi90eXBlcy9hZ2VudCc7XHJcbmltcG9ydCB7IFZhbGlkYXRpb25FcnJvciB9IGZyb20gJy4uL3V0aWxzL2Vycm9yJztcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09IFJlcXVlc3QvUmVzcG9uc2UgVHlwZXMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgVmFsaWRhdGVSZXF1ZXN0IHtcclxuICBzb3VyY2VFbnRpdGllczoge1xyXG4gICAgdGFnczogR1RNVGFnW107XHJcbiAgICB0cmlnZ2VyczogR1RNVHJpZ2dlcltdO1xyXG4gICAgdmFyaWFibGVzOiBHVE1WYXJpYWJsZVtdO1xyXG4gIH07XHJcbiAgaWRNYXBwaW5nOiBJZE1hcHBpbmc7XHJcbiAgc291cmNlV29ya3NwYWNlPzogeyBjb250YWluZXJJZDogc3RyaW5nOyB3b3Jrc3BhY2VJZDogc3RyaW5nIH07XHJcbiAgdGFyZ2V0V29ya3NwYWNlPzogeyBjb250YWluZXJJZDogc3RyaW5nOyB3b3Jrc3BhY2VJZDogc3RyaW5nIH07XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUHJlVmFsaWRhdGVSZXF1ZXN0IHtcclxuICBlbnRpdGllc1RvQ3JlYXRlOiB7XHJcbiAgICB0YWdzOiBQYXJ0aWFsPEdUTVRhZz5bXTtcclxuICAgIHRyaWdnZXJzOiBQYXJ0aWFsPEdUTVRyaWdnZXI+W107XHJcbiAgICB2YXJpYWJsZXM6IFBhcnRpYWw8R1RNVmFyaWFibGU+W107XHJcbiAgfTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJbnRlZ3JpdHlDaGVja1JlcXVlc3Qge1xyXG4gIC8vIE5vIGFkZGl0aW9uYWwgZGF0YSBuZWVkZWQsIHVzZXMgdGFyZ2V0IHdvcmtzcGFjZSBlbnRpdGllc1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBWYWxpZGF0b3IgQWdlbnQgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmV4cG9ydCBjbGFzcyBWYWxpZGF0b3JBZ2VudCBleHRlbmRzIEJhc2VBZ2VudCB7XHJcbiAgcHJpdmF0ZSBjaGVja2VyOiBWYWxpZGF0aW9uQ2hlY2tlcjtcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICBzdXBlcigndmFsaWRhdG9yJyk7XHJcbiAgICB0aGlzLmNoZWNrZXIgPSBuZXcgVmFsaWRhdGlvbkNoZWNrZXIoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOyalOyyrSDsspjrpqxcclxuICAgKi9cclxuICBhc3luYyBleGVjdXRlPFQsIFI+KHJlcXVlc3Q6IEFnZW50UmVxdWVzdDxUPik6IFByb21pc2U8QWdlbnRSZXNwb25zZTxSPj4ge1xyXG4gICAgdGhpcy52YWxpZGF0ZUNvbnRleHQoKTtcclxuXHJcbiAgICBzd2l0Y2ggKHJlcXVlc3QuYWN0aW9uKSB7XHJcbiAgICAgIGNhc2UgJ3ZhbGlkYXRlJzpcclxuICAgICAgICByZXR1cm4gdGhpcy52YWxpZGF0ZShyZXF1ZXN0LmRhdGEgYXMgVmFsaWRhdGVSZXF1ZXN0KSBhcyBQcm9taXNlPEFnZW50UmVzcG9uc2U8Uj4+O1xyXG5cclxuICAgICAgY2FzZSAncHJlVmFsaWRhdGUnOlxyXG4gICAgICAgIHJldHVybiB0aGlzLnByZVZhbGlkYXRlKHJlcXVlc3QuZGF0YSBhcyBQcmVWYWxpZGF0ZVJlcXVlc3QpIGFzIFByb21pc2U8QWdlbnRSZXNwb25zZTxSPj47XHJcblxyXG4gICAgICBjYXNlICdjaGVja0ludGVncml0eSc6XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hlY2tJbnRlZ3JpdHkoKSBhcyBQcm9taXNlPEFnZW50UmVzcG9uc2U8Uj4+O1xyXG5cclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYWN0aW9uOiAke3JlcXVlc3QuYWN0aW9ufWApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7IOd7ISxIOqysOqzvCDqsoDspp1cclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIHZhbGlkYXRlKFxyXG4gICAgcmVxdWVzdDogVmFsaWRhdGVSZXF1ZXN0XHJcbiAgKTogUHJvbWlzZTxBZ2VudFJlc3BvbnNlPFZhbGlkYXRpb25SZXBvcnQ+PiB7XHJcbiAgICByZXR1cm4gdGhpcy5zYWZlRXhlY3V0ZShcclxuICAgICAgeyBhY3Rpb246ICd2YWxpZGF0ZScsIGRhdGE6IHJlcXVlc3QsIGNvbnRleHQ6IHRoaXMuY29udGV4dCEgfSxcclxuICAgICAgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ1N0YXJ0aW5nIHZhbGlkYXRpb24nKTtcclxuXHJcbiAgICAgICAgLy8gMS4gVGFyZ2V0IOybjO2BrOyKpO2OmOydtOyKpCDsl5Tti7Dti7Ag7KGw7ZqMXHJcbiAgICAgICAgdGhpcy5yZXBvcnRQcm9ncmVzcygxLCAzLCAnRmV0Y2hpbmcgdGFyZ2V0IGVudGl0aWVzJyk7XHJcbiAgICAgICAgY29uc3QgW3RhcmdldFRhZ3MsIHRhcmdldFRyaWdnZXJzLCB0YXJnZXRWYXJpYWJsZXNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xyXG4gICAgICAgICAgdGhpcy5tY3AhLmxpc3RUYWdzKHsgcmVmcmVzaDogdHJ1ZSB9KSxcclxuICAgICAgICAgIHRoaXMubWNwIS5saXN0VHJpZ2dlcnMoeyByZWZyZXNoOiB0cnVlIH0pLFxyXG4gICAgICAgICAgdGhpcy5tY3AhLmxpc3RWYXJpYWJsZXMoeyByZWZyZXNoOiB0cnVlIH0pXHJcbiAgICAgICAgXSk7XHJcblxyXG4gICAgICAgIHRoaXMucmVwb3J0UHJvZ3Jlc3MoMiwgMywgJ1J1bm5pbmcgdmFsaWRhdGlvbiBjaGVja3MnKTtcclxuXHJcbiAgICAgICAgLy8gMi4g6rKA7KadIOyImO2WiVxyXG4gICAgICAgIGNvbnN0IHJlcG9ydCA9IHRoaXMuY2hlY2tlci52YWxpZGF0ZSh7XHJcbiAgICAgICAgICBzb3VyY2VFbnRpdGllczogcmVxdWVzdC5zb3VyY2VFbnRpdGllcyxcclxuICAgICAgICAgIHRhcmdldEVudGl0aWVzOiB7XHJcbiAgICAgICAgICAgIHRhZ3M6IHRhcmdldFRhZ3MsXHJcbiAgICAgICAgICAgIHRyaWdnZXJzOiB0YXJnZXRUcmlnZ2VycyxcclxuICAgICAgICAgICAgdmFyaWFibGVzOiB0YXJnZXRWYXJpYWJsZXNcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBpZE1hcHBpbmc6IHJlcXVlc3QuaWRNYXBwaW5nLFxyXG4gICAgICAgICAgc291cmNlV29ya3NwYWNlOiByZXF1ZXN0LnNvdXJjZVdvcmtzcGFjZSxcclxuICAgICAgICAgIHRhcmdldFdvcmtzcGFjZTogcmVxdWVzdC50YXJnZXRXb3Jrc3BhY2UgfHwge1xyXG4gICAgICAgICAgICBjb250YWluZXJJZDogdGhpcy5jb250ZXh0IS50YXJnZXRXb3Jrc3BhY2UuY29udGFpbmVySWQsXHJcbiAgICAgICAgICAgIHdvcmtzcGFjZUlkOiB0aGlzLmNvbnRleHQhLnRhcmdldFdvcmtzcGFjZS53b3Jrc3BhY2VJZFxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLnJlcG9ydFByb2dyZXNzKDMsIDMsICdWYWxpZGF0aW9uIGNvbXBsZXRlZCcpO1xyXG5cclxuICAgICAgICAvLyAzLiDqsrDqs7wg66Gc6rmFXHJcbiAgICAgICAgaWYgKHJlcG9ydC5zdWNjZXNzKSB7XHJcbiAgICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKCdWYWxpZGF0aW9uIHBhc3NlZCcsIHJlcG9ydC5zdW1tYXJ5KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5sb2dnZXIud2FybignVmFsaWRhdGlvbiBmYWlsZWQnLCB7XHJcbiAgICAgICAgICAgIG1pc3Npbmc6IHJlcG9ydC5taXNzaW5nLmxlbmd0aCxcclxuICAgICAgICAgICAgYnJva2VuUmVmczogcmVwb3J0LmJyb2tlblJlZmVyZW5jZXMubGVuZ3RoLFxyXG4gICAgICAgICAgICB3YXJuaW5nczogcmVwb3J0Lndhcm5pbmdzLmxlbmd0aFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcmVwb3J0O1xyXG4gICAgICB9XHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7IKs7KCEIOqygOymnSAo7IOd7ISxIOyghClcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIHByZVZhbGlkYXRlKFxyXG4gICAgcmVxdWVzdDogUHJlVmFsaWRhdGVSZXF1ZXN0XHJcbiAgKTogUHJvbWlzZTxBZ2VudFJlc3BvbnNlPHtcclxuICAgIGNhbkNyZWF0ZTogYm9vbGVhbjtcclxuICAgIGNvbmZsaWN0czogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT47XHJcbiAgfT4+IHtcclxuICAgIHJldHVybiB0aGlzLnNhZmVFeGVjdXRlKFxyXG4gICAgICB7IGFjdGlvbjogJ3ByZVZhbGlkYXRlJywgZGF0YTogcmVxdWVzdCwgY29udGV4dDogdGhpcy5jb250ZXh0ISB9LFxyXG4gICAgICBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5sb2dnZXIuaW5mbygnU3RhcnRpbmcgcHJlLXZhbGlkYXRpb24nKTtcclxuXHJcbiAgICAgICAgLy8g6riw7KG0IOyXlO2LsO2LsCDsobDtmoxcclxuICAgICAgICBjb25zdCBbZXhpc3RpbmdUYWdzLCBleGlzdGluZ1RyaWdnZXJzLCBleGlzdGluZ1ZhcmlhYmxlc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXHJcbiAgICAgICAgICB0aGlzLm1jcCEubGlzdFRhZ3MoKSxcclxuICAgICAgICAgIHRoaXMubWNwIS5saXN0VHJpZ2dlcnMoKSxcclxuICAgICAgICAgIHRoaXMubWNwIS5saXN0VmFyaWFibGVzKClcclxuICAgICAgICBdKTtcclxuXHJcbiAgICAgICAgLy8g7IKs7KCEIOqygOymnSDsiJjtlolcclxuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNoZWNrZXIucHJlVmFsaWRhdGUoXHJcbiAgICAgICAgICByZXF1ZXN0LmVudGl0aWVzVG9DcmVhdGUsXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHRhZ3M6IGV4aXN0aW5nVGFncyxcclxuICAgICAgICAgICAgdHJpZ2dlcnM6IGV4aXN0aW5nVHJpZ2dlcnMsXHJcbiAgICAgICAgICAgIHZhcmlhYmxlczogZXhpc3RpbmdWYXJpYWJsZXNcclxuICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKCdQcmUtdmFsaWRhdGlvbiBjb21wbGV0ZWQnLCB7XHJcbiAgICAgICAgICBjYW5DcmVhdGU6IHJlc3VsdC5jYW5DcmVhdGUsXHJcbiAgICAgICAgICBjb25mbGljdHM6IHJlc3VsdC5jb25mbGljdHMubGVuZ3RoXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICBjYW5DcmVhdGU6IHJlc3VsdC5jYW5DcmVhdGUsXHJcbiAgICAgICAgICBjb25mbGljdHM6IHJlc3VsdC5jb25mbGljdHMubWFwKGMgPT4gKHtcclxuICAgICAgICAgICAgdHlwZTogYy50eXBlLFxyXG4gICAgICAgICAgICBuYW1lOiBjLm5hbWUsXHJcbiAgICAgICAgICAgIHJlYXNvbjogYy5yZWFzb25cclxuICAgICAgICAgIH0pKVxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgICk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDssLjsobAg66y06rKw7ISxIOqygOyCrFxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgY2hlY2tJbnRlZ3JpdHkoKTogUHJvbWlzZTxBZ2VudFJlc3BvbnNlPHtcclxuICAgIHZhbGlkOiBib29sZWFuO1xyXG4gICAgaXNzdWVzOiBBcnJheTx7XHJcbiAgICAgIGVudGl0eVR5cGU6IHN0cmluZztcclxuICAgICAgZW50aXR5TmFtZTogc3RyaW5nO1xyXG4gICAgICBpc3N1ZVR5cGU6IHN0cmluZztcclxuICAgICAgZGV0YWlsczogc3RyaW5nO1xyXG4gICAgfT47XHJcbiAgfT4+IHtcclxuICAgIHJldHVybiB0aGlzLnNhZmVFeGVjdXRlKFxyXG4gICAgICB7IGFjdGlvbjogJ2NoZWNrSW50ZWdyaXR5JywgZGF0YToge30sIGNvbnRleHQ6IHRoaXMuY29udGV4dCEgfSxcclxuICAgICAgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0NoZWNraW5nIHJlZmVyZW5jZSBpbnRlZ3JpdHknKTtcclxuXHJcbiAgICAgICAgLy8g66qo65OgIOyXlO2LsO2LsCDsobDtmoxcclxuICAgICAgICBjb25zdCBbdGFncywgdHJpZ2dlcnMsIHZhcmlhYmxlc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXHJcbiAgICAgICAgICB0aGlzLm1jcCEubGlzdFRhZ3MoeyByZWZyZXNoOiB0cnVlIH0pLFxyXG4gICAgICAgICAgdGhpcy5tY3AhLmxpc3RUcmlnZ2Vycyh7IHJlZnJlc2g6IHRydWUgfSksXHJcbiAgICAgICAgICB0aGlzLm1jcCEubGlzdFZhcmlhYmxlcyh7IHJlZnJlc2g6IHRydWUgfSlcclxuICAgICAgICBdKTtcclxuXHJcbiAgICAgICAgLy8g66y06rKw7ISxIOqygOyCrFxyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuY2hlY2tlci5jaGVja0ludGVncml0eSh7IHRhZ3MsIHRyaWdnZXJzLCB2YXJpYWJsZXMgfSk7XHJcblxyXG4gICAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0ludGVncml0eSBjaGVjayBjb21wbGV0ZWQnLCB7XHJcbiAgICAgICAgICB2YWxpZDogcmVzdWx0LnZhbGlkLFxyXG4gICAgICAgICAgaXNzdWVzOiByZXN1bHQuaXNzdWVzLmxlbmd0aFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgdmFsaWQ6IHJlc3VsdC52YWxpZCxcclxuICAgICAgICAgIGlzc3VlczogcmVzdWx0Lmlzc3Vlcy5tYXAoaSA9PiAoe1xyXG4gICAgICAgICAgICBlbnRpdHlUeXBlOiBpLmVudGl0eVR5cGUsXHJcbiAgICAgICAgICAgIGVudGl0eU5hbWU6IGkuZW50aXR5TmFtZSxcclxuICAgICAgICAgICAgaXNzdWVUeXBlOiBpLmlzc3VlVHlwZSxcclxuICAgICAgICAgICAgZGV0YWlsczogaS5kZXRhaWxzXHJcbiAgICAgICAgICB9KSlcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog6rKA7KadIOumrO2PrO2KuCDtj6zrp7ftjIVcclxuICAgKi9cclxuICBmb3JtYXRSZXBvcnQocmVwb3J0OiBWYWxpZGF0aW9uUmVwb3J0KTogc3RyaW5nIHtcclxuICAgIHJldHVybiBmb3JtYXRWYWxpZGF0aW9uUmVwb3J0KHJlcG9ydCk7XHJcbiAgfVxyXG59XHJcbiJdfQ==