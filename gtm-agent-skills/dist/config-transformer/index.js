"use strict";
/**
 * Config Transformer Skill
 *
 * Source 엔티티 Config를 Target용으로 변환
 * - ID 참조 변환 (트리거 ID, 태그 ID)
 * - 변수 참조는 이름 기반이므로 유지
 * - 불필요한 메타데이터 제거
 *
 * @example
 * ```typescript
 * const transformer = new ConfigTransformer(idMapper);
 *
 * // 태그 Config 변환
 * const newTagConfig = transformer.transformTag(sourceTag, { newName: 'New Tag Name' });
 *
 * // 트리거 Config 변환
 * const newTriggerConfig = transformer.transformTrigger(sourceTrigger);
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigTransformer = void 0;
exports.extractCreateConfig = extractCreateConfig;
exports.compareConfigs = compareConfigs;
class ConfigTransformer {
    constructor(idMapper) {
        this.idMapper = idMapper;
    }
    /**
     * 태그 Config 변환
     */
    transformTag(source, options = {}) {
        const newName = this.resolveName(source.name, options);
        // cvt_ type remapping: 커스텀 템플릿의 type을 target container용으로 변환
        let tagType = source.type;
        if (tagType?.startsWith('cvt_')) {
            const remappedType = this.idMapper.getNewTemplateType(tagType);
            if (remappedType) {
                tagType = remappedType;
            }
        }
        const config = {
            name: newName,
            type: tagType,
            tagFiringOption: source.tagFiringOption
        };
        // Parameters 변환
        if (source.parameter) {
            config.parameter = this.transformTagParameters(source.parameter);
        }
        // Firing Triggers 변환
        if (source.firingTriggerId) {
            config.firingTriggerId = this.idMapper.transformIdArray(source.firingTriggerId);
        }
        // Blocking Triggers 변환
        if (source.blockingTriggerId) {
            config.blockingTriggerId = this.idMapper.transformIdArray(source.blockingTriggerId);
        }
        // Setup Tags 변환 - GTM API는 tagName을 사용해야 함 (tagId 사용 시 에러)
        if (source.setupTag) {
            config.setupTag = source.setupTag.map(s => {
                // tagName이 있으면 그대로 유지 (GTM API 요구사항)
                if (s.tagName) {
                    return { tagName: s.tagName };
                }
                // tagId만 있는 경우 - 이름으로 변환 시도
                if (s.tagId) {
                    const mapping = this.idMapper.getMapping(s.tagId);
                    if (mapping?.name) {
                        return { tagName: mapping.name };
                    }
                }
                return s;
            });
        }
        // Teardown Tags 변환 - GTM API는 tagName을 사용해야 함 (tagId 사용 시 에러)
        if (source.teardownTag) {
            config.teardownTag = source.teardownTag.map(t => {
                // tagName이 있으면 그대로 유지 (GTM API 요구사항)
                if (t.tagName) {
                    return { tagName: t.tagName };
                }
                // tagId만 있는 경우 - 이름으로 변환 시도
                if (t.tagId) {
                    const mapping = this.idMapper.getMapping(t.tagId);
                    if (mapping?.name) {
                        return { tagName: mapping.name };
                    }
                }
                return t;
            });
        }
        // Notes 보존 (선택)
        if (options.preserveNotes && source.notes) {
            config.notes = source.notes;
        }
        return config;
    }
    /**
     * 트리거 Config 변환
     */
    transformTrigger(source, options = {}) {
        const newName = this.resolveName(source.name, options);
        const config = {
            name: newName,
            type: source.type
        };
        // Parameters 변환
        if (source.parameter) {
            config.parameter = this.transformParameters(source.parameter);
        }
        // Filters (변수 참조는 이름 기반이므로 그대로 복사)
        if (source.filter) {
            config.filter = JSON.parse(JSON.stringify(source.filter));
        }
        if (source.autoEventFilter) {
            config.autoEventFilter = JSON.parse(JSON.stringify(source.autoEventFilter));
        }
        if (source.customEventFilter) {
            config.customEventFilter = JSON.parse(JSON.stringify(source.customEventFilter));
        }
        // Notes 보존 (선택)
        if (options.preserveNotes && source.notes) {
            config.notes = source.notes;
        }
        return config;
    }
    /**
     * 변수 Config 변환
     */
    transformVariable(source, options = {}) {
        const newName = this.resolveName(source.name, options);
        const config = {
            name: newName,
            type: source.type
        };
        // Parameters 변환
        if (source.parameter) {
            config.parameter = this.transformParameters(source.parameter);
        }
        // Notes 보존 (선택)
        if (options.preserveNotes && source.notes) {
            config.notes = source.notes;
        }
        return config;
    }
    /**
     * 태그 Parameters 변환 (configTagId 등 ID 참조 포함)
     */
    transformTagParameters(parameters) {
        return parameters.map(param => {
            const newParam = this.transformParameter(param);
            // GA4 Config Tag 참조 변환
            if (param.key === 'configTagId' && param.value) {
                const newId = this.idMapper.getNewId(param.value);
                if (newId) {
                    newParam.value = newId;
                }
            }
            // measurementId (GA4) - 그대로 유지
            // trackingId (UA) - 그대로 유지
            return newParam;
        });
    }
    /**
     * Parameters 변환 (일반)
     */
    transformParameters(parameters) {
        return parameters.map(param => this.transformParameter(param));
    }
    /**
     * 단일 Parameter 변환
     */
    transformParameter(param) {
        const newParam = {
            type: param.type,
            key: param.key
        };
        // value 복사 ({{variable}} 참조는 이름 기반이므로 유지)
        if (param.value !== undefined) {
            newParam.value = param.value;
        }
        // 중첩 list 변환
        if (param.list) {
            newParam.list = param.list.map(p => this.transformParameter(p));
        }
        // 중첩 map 변환
        if (param.map) {
            newParam.map = param.map.map(p => this.transformParameter(p));
        }
        return newParam;
    }
    /**
     * 이름 결정
     */
    resolveName(originalName, options) {
        if (options.newName) {
            return options.newName;
        }
        const prefix = options.namePrefix || '';
        const suffix = options.nameSuffix || '';
        return `${prefix}${originalName}${suffix}`;
    }
}
exports.ConfigTransformer = ConfigTransformer;
// ==================== Utility Functions ====================
/**
 * 엔티티에서 생성용 Config 추출 (메타데이터 제거)
 */
function extractCreateConfig(entity) {
    const config = { ...entity };
    // 메타데이터 제거
    delete config.accountId;
    delete config.containerId;
    delete config.workspaceId;
    delete config.tagId;
    delete config.triggerId;
    delete config.variableId;
    delete config.templateId;
    delete config.fingerprint;
    delete config.path;
    delete config.parentFolderId;
    delete config.tagManagerUrl;
    // Template 전용: galleryReference 제거 (새 템플릿으로 생성)
    if ('templateData' in entity) {
        delete config.galleryReference;
    }
    return config;
}
/**
 * 두 Config 비교 (변경 사항 확인용)
 */
function compareConfigs(source, target) {
    const differences = [];
    const allKeys = new Set([
        ...Object.keys(source),
        ...Object.keys(target)
    ]);
    for (const key of allKeys) {
        const sourceVal = source[key];
        const targetVal = target[key];
        if (JSON.stringify(sourceVal) !== JSON.stringify(targetVal)) {
            differences.push({
                field: key,
                source: sourceVal,
                target: targetVal
            });
        }
    }
    return {
        identical: differences.length === 0,
        differences
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29uZmlnLXRyYW5zZm9ybWVyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBa0JHOzs7QUF1UEgsa0RBd0JDO0FBS0Qsd0NBK0JDO0FBalNELE1BQWEsaUJBQWlCO0lBQzVCLFlBQW9CLFFBQWtCO1FBQWxCLGFBQVEsR0FBUixRQUFRLENBQVU7SUFBRyxDQUFDO0lBRTFDOztPQUVHO0lBQ0gsWUFBWSxDQUNWLE1BQWMsRUFDZCxVQUE0QixFQUFFO1FBRTlCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUV2RCw2REFBNkQ7UUFDN0QsSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUMxQixJQUFJLE9BQU8sRUFBRSxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNoQyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQy9ELElBQUksWUFBWSxFQUFFLENBQUM7Z0JBQ2pCLE9BQU8sR0FBRyxZQUFZLENBQUM7WUFDekIsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBb0I7WUFDOUIsSUFBSSxFQUFFLE9BQU87WUFDYixJQUFJLEVBQUUsT0FBTztZQUNiLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZTtTQUN4QyxDQUFDO1FBRUYsZ0JBQWdCO1FBQ2hCLElBQUksTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBRUQscUJBQXFCO1FBQ3JCLElBQUksTUFBTSxDQUFDLGVBQWUsRUFBRSxD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QUMsRUFBRSxDQUFDO1lBQzVELFdBQVcsQ0FBQyxJQUFJLENBQUM7Z0JBQ2YsS0FBSyxFQUFFLEdBQUc7Z0JBQ1YsTUFBTSxFQUFFLFNBQVM7Z0JBQ2pCLE1BQU0sRUFBRSxTQUFTO2FBQ2xCLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDO0lBRUQsT0FBTztRQUNMLFNBQVMsRUFBRSxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUM7UUFDbkMsV0FBVztLQUNaLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIENvbmZpZyBUcmFuc2Zvcm1lciBTa2lsbFxyXG4gKlxyXG4gKiBTb3VyY2Ug7JeU7Yuw7YuwIENvbmZpZ+ulvCBUYXJnZXTsmqnsnLzroZwg67OA7ZmYXHJcbiAqIC0gSUQg7LC47KGwIOuzgO2ZmCAo7Yq466as6rGwIElELCDtg5zqt7ggSUQpXHJcbiAqIC0g67OA7IiYIOywuOyhsOuKlCDsnbTrpoQg6riw67CY7J2066+A66GcIOycoOyngFxyXG4gKiAtIOu2iO2VhOyalO2VnCDrqZTtg4DrjbDsnbTthLAg7KCc6rGwXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYHR5cGVzY3JpcHRcclxuICogY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgQ29uZmlnVHJhbnNmb3JtZXIoaWRNYXBwZXIpO1xyXG4gKlxyXG4gKiAvLyDtg5zqt7ggQ29uZmlnIOuzgO2ZmFxyXG4gKiBjb25zdCBuZXdUYWdDb25maWcgPSB0cmFuc2Zvcm1lci50cmFuc2Zvcm1UYWcoc291cmNlVGFnLCB7IG5ld05hbWU6ICdOZXcgVGFnIE5hbWUnIH0pO1xyXG4gKlxyXG4gKiAvLyDtirjrpqzqsbAgQ29uZmlnIOuzgO2ZmFxyXG4gKiBjb25zdCBuZXdUcmlnZ2VyQ29uZmlnID0gdHJhbnNmb3JtZXIudHJhbnNmb3JtVHJpZ2dlcihzb3VyY2VUcmlnZ2VyKTtcclxuICogYGBgXHJcbiAqL1xyXG5cclxuaW1wb3J0IHtcclxuICBHVE1UYWcsXHJcbiAgR1RNVHJpZ2dlcixcclxuICBHVE1WYXJpYWJsZSxcclxuICBHVE1UZW1wbGF0ZSxcclxuICBHVE1QYXJhbWV0ZXJcclxufSBmcm9tICcuLi90eXBlcy9ndG0nO1xyXG5pbXBvcnQgeyBJZE1hcHBlciB9IGZyb20gJy4uL2lkLW1hcHBlcic7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFRyYW5zZm9ybU9wdGlvbnMge1xyXG4gIG5ld05hbWU/OiBzdHJpbmc7XHJcbiAgbmFtZVByZWZpeD86IHN0cmluZztcclxuICBuYW1lU3VmZml4Pzogc3RyaW5nO1xyXG4gIHByZXNlcnZlTm90ZXM/OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQ29uZmlnVHJhbnNmb3JtZXIge1xyXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgaWRNYXBwZXI6IElkTWFwcGVyKSB7fVxyXG5cclxuICAvKipcclxuICAgKiDtg5zqt7ggQ29uZmlnIOuzgO2ZmFxyXG4gICAqL1xyXG4gIHRyYW5zZm9ybVRhZyhcclxuICAgIHNvdXJjZTogR1RNVGFnLFxyXG4gICAgb3B0aW9uczogVHJhbnNmb3JtT3B0aW9ucyA9IHt9XHJcbiAgKTogUGFydGlhbDxHVE1UYWc+IHtcclxuICAgIGNvbnN0IG5ld05hbWUgPSB0aGlzLnJlc29sdmVOYW1lKHNvdXJjZS5uYW1lLCBvcHRpb25zKTtcclxuXHJcbiAgICAvLyBjdnRfIHR5cGUgcmVtYXBwaW5nOiDsu6TsiqTthYAg7YWc7ZSM66a/7J2YIHR5cGXsnYQgdGFyZ2V0IGNvbnRhaW5lcuyaqeycvOuhnCDrs4DtmZhcclxuICAgIGxldCB0YWdUeXBlID0gc291cmNlLnR5cGU7XHJcbiAgICBpZiAodGFnVHlwZT8uc3RhcnRzV2l0aCgnY3Z0XycpKSB7XHJcbiAgICAgIGNvbnN0IHJlbWFwcGVkVHlwZSA9IHRoaXMuaWRNYXBwZXIuZ2V0TmV3VGVtcGxhdGVUeXBlKHRhZ1R5cGUpO1xyXG4gICAgICBpZiAocmVtYXBwZWRUeXBlKSB7XHJcbiAgICAgICAgdGFnVHlwZSA9IHJlbWFwcGVkVHlwZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbmZpZzogUGFydGlhbDxHVE1UYWc+ID0ge1xyXG4gICAgICBuYW1lOiBuZXdOYW1lLFxyXG4gICAgICB0eXBlOiB0YWdUeXBlLFxyXG4gICAgICB0YWdGaXJpbmdPcHRpb246IHNvdXJjZS50YWdGaXJpbmdPcHRpb25cclxuICAgIH07XHJcblxyXG4gICAgLy8gUGFyYW1ldGVycyDrs4DtmZhcclxuICAgIGlmIChzb3VyY2UucGFyYW1ldGVyKSB7XHJcbiAgICAgIGNvbmZpZy5wYXJhbWV0ZXIgPSB0aGlzLnRyYW5zZm9ybVRhZ1BhcmFtZXRlcnMoc291cmNlLnBhcmFtZXRlcik7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRmlyaW5nIFRyaWdnZXJzIOuzgO2ZmFxyXG4gICAgaWYgKHNvdXJjZS5maXJpbmdUcmlnZ2VySWQpIHtcclxuICAgICAgY29uZmlnLmZpcmluZ1RyaWdnZXJJZCA9IHRoaXMuaWRNYXBwZXIudHJhbnNmb3JtSWRBcnJheShzb3VyY2UuZmlyaW5nVHJpZ2dlcklkKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBCbG9ja2luZyBUcmlnZ2VycyDrs4DtmZhcclxuICAgIGlmIChzb3VyY2UuYmxvY2tpbmdUcmlnZ2VySWQpIHtcclxuICAgICAgY29uZmlnLmJsb2NraW5nVHJpZ2dlcklkID0gdGhpcy5pZE1hcHBlci50cmFuc2Zvcm1JZEFycmF5KHNvdXJjZS5ibG9ja2luZ1RyaWdnZXJJZCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU2V0dXAgVGFncyDrs4DtmZggLSBHVE0gQVBJ64qUIHRhZ05hbWXsnYQg7IKs7Jqp7ZW07JW8IO2VqCAodGFnSWQg7IKs7JqpIOyLnCDsl5Drn6wpXHJcbiAgICBpZiAoc291cmNlLnNldHVwVGFnKSB7XHJcbiAgICAgIGNvbmZpZy5zZXR1cFRhZyA9IHNvdXJjZS5zZXR1cFRhZy5tYXAocyA9PiB7XHJcbiAgICAgICAgLy8gdGFnTmFtZeydtCDsnojsnLzrqbQg6re464yA66GcIOycoOyngCAoR1RNIEFQSSDsmpTqtazsgqztla0pXHJcbiAgICAgICAgaWYgKHMudGFnTmFtZSkge1xyXG4gICAgICAgICAgcmV0dXJuIHsgdGFnTmFtZTogcy50YWdOYW1lIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIHRhZ0lk66eMIOyeiOuKlCDqsr3smrAgLSDsnbTrpoTsnLzroZwg67OA7ZmYIOyLnOuPhFxyXG4gICAgICAgIGlmIChzLnRhZ0lkKSB7XHJcbiAgICAgICAgICBjb25zdCBtYXBwaW5nID0gdGhpcy5pZE1hcHBlci5nZXRNYXBwaW5nKHMudGFnSWQpO1xyXG4gICAgICAgICAgaWYgKG1hcHBpbmc/Lm5hbWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdGFnTmFtZTogbWFwcGluZy5uYW1lIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBUZWFyZG93biBUYWdzIOuzgO2ZmCAtIEdUTSBBUEnripQgdGFnTmFtZeydhCDsgqzsmqntlbTslbwg7ZWoICh0YWdJZCDsgqzsmqkg7IucIOyXkOufrClcclxuICAgIGlmIChzb3VyY2UudGVhcmRvd25UYWcpIHtcclxuICAgICAgY29uZmlnLnRlYXJkb3duVGFnID0gc291cmNlLnRlYXJkb3duVGFnLm1hcCh0ID0+IHtcclxuICAgICAgICAvLyB0YWdOYW1l7J20IOyeiOycvOuptCDqt7jrjIDroZwg7Jyg7KeAIChHVE0gQVBJIOyalOq1rOyCrO2VrSlcclxuICAgICAgICBpZiAodC50YWdOYW1lKSB7XHJcbiAgICAgICAgICByZXR1cm4geyB0YWdOYW1lOiB0LnRhZ05hbWUgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gdGFnSWTrp4wg7J6I64qUIOqyveyasCAtIOydtOumhOycvOuhnCDrs4DtmZgg7Iuc64+EXHJcbiAgICAgICAgaWYgKHQudGFnSWQpIHtcclxuICAgICAgICAgIGNvbnN0IG1hcHBpbmcgPSB0aGlzLmlkTWFwcGVyLmdldE1hcHBpbmcodC50YWdJZCk7XHJcbiAgICAgICAgICBpZiAobWFwcGluZz8ubmFtZSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyB0YWdOYW1lOiBtYXBwaW5nLm5hbWUgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIE5vdGVzIOuztOyhtCAo7ISg7YOdKVxyXG4gICAgaWYgKG9wdGlvbnMucHJlc2VydmVOb3RlcyAmJiBzb3VyY2Uubm90ZXMpIHtcclxuICAgICAgY29uZmlnLm5vdGVzID0gc291cmNlLm5vdGVzO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBjb25maWc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDtirjrpqzqsbAgQ29uZmlnIOuzgO2ZmFxyXG4gICAqL1xyXG4gIHRyYW5zZm9ybVRyaWdnZXIoXHJcbiAgICBzb3VyY2U6IEdUTVRyaWdnZXIsXHJcbiAgICBvcHRpb25zOiBUcmFuc2Zvcm1PcHRpb25zID0ge31cclxuICApOiBQYXJ0aWFsPEdUTVRyaWdnZXI+IHtcclxuICAgIGNvbnN0IG5ld05hbWUgPSB0aGlzLnJlc29sdmVOYW1lKHNvdXJjZS5uYW1lLCBvcHRpb25zKTtcclxuXHJcbiAgICBjb25zdCBjb25maWc6IFBhcnRpYWw8R1RNVHJpZ2dlcj4gPSB7XHJcbiAgICAgIG5hbWU6IG5ld05hbWUsXHJcbiAgICAgIHR5cGU6IHNvdXJjZS50eXBlXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFBhcmFtZXRlcnMg67OA7ZmYXHJcbiAgICBpZiAoc291cmNlLnBhcmFtZXRlcikge1xyXG4gICAgICBjb25maWcucGFyYW1ldGVyID0gdGhpcy50cmFuc2Zvcm1QYXJhbWV0ZXJzKHNvdXJjZS5wYXJhbWV0ZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEZpbHRlcnMgKOuzgOyImCDssLjsobDripQg7J2066aEIOq4sOuwmOydtOuvgOuhnCDqt7jrjIDroZwg67O17IKsKVxyXG4gICAgaWYgKHNvdXJjZS5maWx0ZXIpIHtcclxuICAgICAgY29uZmlnLmZpbHRlciA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoc291cmNlLmZpbHRlcikpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChzb3VyY2UuYXV0b0V2ZW50RmlsdGVyKSB7XHJcbiAgICAgIGNvbmZpZy5hdXRvRXZlbnRGaWx0ZXIgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHNvdXJjZS5hdXRvRXZlbnRGaWx0ZXIpKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoc291cmNlLmN1c3RvbUV2ZW50RmlsdGVyKSB7XHJcbiAgICAgIGNvbmZpZy5jdXN0b21FdmVudEZpbHRlciA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoc291cmNlLmN1c3RvbUV2ZW50RmlsdGVyKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gTm90ZXMg67O07KG0ICjshKDtg50pXHJcbiAgICBpZiAob3B0aW9ucy5wcmVzZXJ2ZU5vdGVzICYmIHNvdXJjZS5ub3Rlcykge1xyXG4gICAgICBjb25maWcubm90ZXMgPSBzb3VyY2Uubm90ZXM7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGNvbmZpZztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOuzgOyImCBDb25maWcg67OA7ZmYXHJcbiAgICovXHJcbiAgdHJhbnNmb3JtVmFyaWFibGUoXHJcbiAgICBzb3VyY2U6IEdUTVZhcmlhYmxlLFxyXG4gICAgb3B0aW9uczogVHJhbnNmb3JtT3B0aW9ucyA9IHt9XHJcbiAgKTogUGFydGlhbDxHVE1WYXJpYWJsZT4ge1xyXG4gICAgY29uc3QgbmV3TmFtZSA9IHRoaXMucmVzb2x2ZU5hbWUoc291cmNlLm5hbWUsIG9wdGlvbnMpO1xyXG5cclxuICAgIGNvbnN0IGNvbmZpZzogUGFydGlhbDxHVE1WYXJpYWJsZT4gPSB7XHJcbiAgICAgIG5hbWU6IG5ld05hbWUsXHJcbiAgICAgIHR5cGU6IHNvdXJjZS50eXBlXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFBhcmFtZXRlcnMg67OA7ZmYXHJcbiAgICBpZiAoc291cmNlLnBhcmFtZXRlcikge1xyXG4gICAgICBjb25maWcucGFyYW1ldGVyID0gdGhpcy50cmFuc2Zvcm1QYXJhbWV0ZXJzKHNvdXJjZS5wYXJhbWV0ZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIE5vdGVzIOuztOyhtCAo7ISg7YOdKVxyXG4gICAgaWYgKG9wdGlvbnMucHJlc2VydmVOb3RlcyAmJiBzb3VyY2Uubm90ZXMpIHtcclxuICAgICAgY29uZmlnLm5vdGVzID0gc291cmNlLm5vdGVzO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBjb25maWc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDtg5zqt7ggUGFyYW1ldGVycyDrs4DtmZggKGNvbmZpZ1RhZ0lkIOuTsSBJRCDssLjsobAg7Y+s7ZWoKVxyXG4gICAqL1xyXG4gIHByaXZhdGUgdHJhbnNmb3JtVGFnUGFyYW1ldGVycyhwYXJhbWV0ZXJzOiBHVE1QYXJhbWV0ZXJbXSk6IEdUTVBhcmFtZXRlcltdIHtcclxuICAgIHJldHVybiBwYXJhbWV0ZXJzLm1hcChwYXJhbSA9PiB7XHJcbiAgICAgIGNvbnN0IG5ld1BhcmFtID0gdGhpcy50cmFuc2Zvcm1QYXJhbWV0ZXIocGFyYW0pO1xyXG5cclxuICAgICAgLy8gR0E0IENvbmZpZyBUYWcg7LC47KGwIOuzgO2ZmFxyXG4gICAgICBpZiAocGFyYW0ua2V5ID09PSAnY29uZmlnVGFnSWQnICYmIHBhcmFtLnZhbHVlKSB7XHJcbiAgICAgICAgY29uc3QgbmV3SWQgPSB0aGlzLmlkTWFwcGVyLmdldE5ld0lkKHBhcmFtLnZhbHVlKTtcclxuICAgICAgICBpZiAobmV3SWQpIHtcclxuICAgICAgICAgIG5ld1BhcmFtLnZhbHVlID0gbmV3SWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBtZWFzdXJlbWVudElkIChHQTQpIC0g6re464yA66GcIOycoOyngFxyXG4gICAgICAvLyB0cmFja2luZ0lkIChVQSkgLSDqt7jrjIDroZwg7Jyg7KeAXHJcblxyXG4gICAgICByZXR1cm4gbmV3UGFyYW07XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFBhcmFtZXRlcnMg67OA7ZmYICjsnbzrsJgpXHJcbiAgICovXHJcbiAgcHJpdmF0ZSB0cmFuc2Zvcm1QYXJhbWV0ZXJzKHBhcmFtZXRlcnM6IEdUTVBhcmFtZXRlcltdKTogR1RNUGFyYW1ldGVyW10ge1xyXG4gICAgcmV0dXJuIHBhcmFtZXRlcnMubWFwKHBhcmFtID0+IHRoaXMudHJhbnNmb3JtUGFyYW1ldGVyKHBhcmFtKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDri6jsnbwgUGFyYW1ldGVyIOuzgO2ZmFxyXG4gICAqL1xyXG4gIHByaXZhdGUgdHJhbnNmb3JtUGFyYW1ldGVyKHBhcmFtOiBHVE1QYXJhbWV0ZXIpOiBHVE1QYXJhbWV0ZXIge1xyXG4gICAgY29uc3QgbmV3UGFyYW06IEdUTVBhcmFtZXRlciA9IHtcclxuICAgICAgdHlwZTogcGFyYW0udHlwZSxcclxuICAgICAga2V5OiBwYXJhbS5rZXlcclxuICAgIH07XHJcblxyXG4gICAgLy8gdmFsdWUg67O17IKsICh7e3ZhcmlhYmxlfX0g7LC47KGw64qUIOydtOumhCDquLDrsJjsnbTrr4DroZwg7Jyg7KeAKVxyXG4gICAgaWYgKHBhcmFtLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgbmV3UGFyYW0udmFsdWUgPSBwYXJhbS52YWx1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyDspJHssqkgbGlzdCDrs4DtmZhcclxuICAgIGlmIChwYXJhbS5saXN0KSB7XHJcbiAgICAgIG5ld1BhcmFtLmxpc3QgPSBwYXJhbS5saXN0Lm1hcChwID0+IHRoaXMudHJhbnNmb3JtUGFyYW1ldGVyKHApKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyDspJHssqkgbWFwIOuzgO2ZmFxyXG4gICAgaWYgKHBhcmFtLm1hcCkge1xyXG4gICAgICBuZXdQYXJhbS5tYXAgPSBwYXJhbS5tYXAubWFwKHAgPT4gdGhpcy50cmFuc2Zvcm1QYXJhbWV0ZXIocCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBuZXdQYXJhbTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOydtOumhCDqsrDsoJVcclxuICAgKi9cclxuICBwcml2YXRlIHJlc29sdmVOYW1lKG9yaWdpbmFsTmFtZTogc3RyaW5nLCBvcHRpb25zOiBUcmFuc2Zvcm1PcHRpb25zKTogc3RyaW5nIHtcclxuICAgIGlmIChvcHRpb25zLm5ld05hbWUpIHtcclxuICAgICAgcmV0dXJuIG9wdGlvbnMubmV3TmFtZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwcmVmaXggPSBvcHRpb25zLm5hbWVQcmVmaXggfHwgJyc7XHJcbiAgICBjb25zdCBzdWZmaXggPSBvcHRpb25zLm5hbWVTdWZmaXggfHwgJyc7XHJcblxyXG4gICAgcmV0dXJuIGAke3ByZWZpeH0ke29yaWdpbmFsTmFtZX0ke3N1ZmZpeH1gO1xyXG4gIH1cclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT0gVXRpbGl0eSBGdW5jdGlvbnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiDsl5Tti7Dti7Dsl5DshJwg7IOd7ISx7JqpIENvbmZpZyDstpTstpwgKOuplO2DgOuNsOydtO2EsCDsoJzqsbApXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdENyZWF0ZUNvbmZpZzxUIGV4dGVuZHMgR1RNVGFnIHwgR1RNVHJpZ2dlciB8IEdUTVZhcmlhYmxlIHwgR1RNVGVtcGxhdGU+KFxyXG4gIGVudGl0eTogVFxyXG4pOiBQYXJ0aWFsPFQ+IHtcclxuICBjb25zdCBjb25maWcgPSB7IC4uLmVudGl0eSB9IGFzIGFueTtcclxuXHJcbiAgLy8g66mU7YOA642w7J207YSwIOygnOqxsFxyXG4gIGRlbGV0ZSBjb25maWcuYWNjb3VudElkO1xyXG4gIGRlbGV0ZSBjb25maWcuY29udGFpbmVySWQ7XHJcbiAgZGVsZXRlIGNvbmZpZy53b3Jrc3BhY2VJZDtcclxuICBkZWxldGUgY29uZmlnLnRhZ0lkO1xyXG4gIGRlbGV0ZSBjb25maWcudHJpZ2dlcklkO1xyXG4gIGRlbGV0ZSBjb25maWcudmFyaWFibGVJZDtcclxuICBkZWxldGUgY29uZmlnLnRlbXBsYXRlSWQ7XHJcbiAgZGVsZXRlIGNvbmZpZy5maW5nZXJwcmludDtcclxuICBkZWxldGUgY29uZmlnLnBhdGg7XHJcbiAgZGVsZXRlIGNvbmZpZy5wYXJlbnRGb2xkZXJJZDtcclxuICBkZWxldGUgY29uZmlnLnRhZ01hbmFnZXJVcmw7XHJcblxyXG4gIC8vIFRlbXBsYXRlIOyghOyaqTogZ2FsbGVyeVJlZmVyZW5jZSDsoJzqsbAgKOyDiCDthZztlIzrpr/snLzroZwg7IOd7ISxKVxyXG4gIGlmICgndGVtcGxhdGVEYXRhJyBpbiBlbnRpdHkpIHtcclxuICAgIGRlbGV0ZSBjb25maWcuZ2FsbGVyeVJlZmVyZW5jZTtcclxuICB9XHJcblxyXG4gIHJldHVybiBjb25maWc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDrkZAgQ29uZmlnIOu5hOq1kCAo67OA6rK9IOyCrO2VrSDtmZXsnbjsmqkpXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY29tcGFyZUNvbmZpZ3MoXHJcbiAgc291cmNlOiBQYXJ0aWFsPEdUTVRhZyB8IEdUTVRyaWdnZXIgfCBHVE1WYXJpYWJsZT4sXHJcbiAgdGFyZ2V0OiBQYXJ0aWFsPEdUTVRhZyB8IEdUTVRyaWdnZXIgfCBHVE1WYXJpYWJsZT5cclxuKToge1xyXG4gIGlkZW50aWNhbDogYm9vbGVhbjtcclxuICBkaWZmZXJlbmNlczogQXJyYXk8eyBmaWVsZDogc3RyaW5nOyBzb3VyY2U6IGFueTsgdGFyZ2V0OiBhbnkgfT47XHJcbn0ge1xyXG4gIGNvbnN0IGRpZmZlcmVuY2VzOiBBcnJheTx7IGZpZWxkOiBzdHJpbmc7IHNvdXJjZTogYW55OyB0YXJnZXQ6IGFueSB9PiA9IFtdO1xyXG5cclxuICBjb25zdCBhbGxLZXlzID0gbmV3IFNldChbXHJcbiAgICAuLi5PYmplY3Qua2V5cyhzb3VyY2UpLFxyXG4gICAgLi4uT2JqZWN0LmtleXModGFyZ2V0KVxyXG4gIF0pO1xyXG5cclxuICBmb3IgKGNvbnN0IGtleSBvZiBhbGxLZXlzKSB7XHJcbiAgICBjb25zdCBzb3VyY2VWYWwgPSAoc291cmNlIGFzIGFueSlba2V5XTtcclxuICAgIGNvbnN0IHRhcmdldFZhbCA9ICh0YXJnZXQgYXMgYW55KVtrZXldO1xyXG5cclxuICAgIGlmIChKU09OLnN0cmluZ2lmeShzb3VyY2VWYWwpICE9PSBKU09OLnN0cmluZ2lmeSh0YXJnZXRWYWwpKSB7XHJcbiAgICAgIGRpZmZlcmVuY2VzLnB1c2goe1xyXG4gICAgICAgIGZpZWxkOiBrZXksXHJcbiAgICAgICAgc291cmNlOiBzb3VyY2VWYWwsXHJcbiAgICAgICAgdGFyZ2V0OiB0YXJnZXRWYWxcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgaWRlbnRpY2FsOiBkaWZmZXJlbmNlcy5sZW5ndGggPT09IDAsXHJcbiAgICBkaWZmZXJlbmNlc1xyXG4gIH07XHJcbn1cclxuIl19