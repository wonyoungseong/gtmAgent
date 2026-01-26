"use strict";
/**
 * GTM Entity Parsers
 * 태그/트리거/변수에서 의존성 참조 추출
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTagDependencies = extractTagDependencies;
exports.extractTriggerDependencies = extractTriggerDependencies;
exports.extractVariableDependencies = extractVariableDependencies;
exports.getVariableTypeInfo = getVariableTypeInfo;
exports.extractCustomEventName = extractCustomEventName;
exports.extractPushedEvents = extractPushedEvents;
const gtm_1 = require("../types/gtm");
const dependency_1 = require("../types/dependency");
const known_event_pushers_1 = require("./known-event-pushers");
// ==================== Tag Parser ====================
/**
 * 태그에서 의존성 추출
 */
function extractTagDependencies(tag) {
    const dependencies = [];
    // 1. Firing Triggers
    if (tag.firingTriggerId) {
        for (const triggerId of tag.firingTriggerId) {
            dependencies.push({
                targetId: triggerId,
                targetType: gtm_1.EntityType.TRIGGER,
                dependencyType: dependency_1.DependencyType.FIRING_TRIGGER,
                location: 'firingTriggerId'
            });
        }
    }
    // 2. Blocking Triggers
    if (tag.blockingTriggerId) {
        for (const triggerId of tag.blockingTriggerId) {
            dependencies.push({
                targetId: triggerId,
                targetType: gtm_1.EntityType.TRIGGER,
                dependencyType: dependency_1.DependencyType.BLOCKING_TRIGGER,
                location: 'blockingTriggerId'
            });
        }
    }
    // 3. Setup Tags
    if (tag.setupTag) {
        for (const setup of tag.setupTag) {
            // tagId가 있으면 사용, 없으면 tagName으로 name: 형식 사용
            const targetId = setup.tagId || (setup.tagName ? `name:${setup.tagName}` : undefined);
            if (targetId) {
                dependencies.push({
                    targetId,
                    targetType: gtm_1.EntityType.TAG,
                    dependencyType: dependency_1.DependencyType.SETUP_TAG,
                    location: 'setupTag',
                    tagName: setup.tagName
                });
            }
        }
    }
    // 4. Teardown Tags
    if (tag.teardownTag) {
        for (const teardown of tag.teardownTag) {
            // tagId가 있으면 사용, 없으면 tagName으로 name: 형식 사용
            const targetId = teardown.tagId || (teardown.tagName ? `name:${teardown.tagName}` : undefined);
            if (targetId) {
                dependencies.push({
                    targetId,
                    targetType: gtm_1.EntityType.TAG,
                    dependencyType: dependency_1.DependencyType.TEARDOWN_TAG,
                    location: 'teardownTag',
                    tagName: teardown.tagName
                });
            }
        }
    }
    // 5. Parameters (변수 참조)
    if (tag.parameter) {
        const paramDeps = extractParameterDependencies(tag.parameter, 'parameter');
        dependencies.push(...paramDeps);
        // GA4 Config Tag 참조 (configTagId)
        const configTagParam = tag.parameter.find(p => p.key === 'configTagId');
        if (configTagParam?.value) {
            dependencies.push({
                targetId: configTagParam.value,
                targetType: gtm_1.EntityType.TAG,
                dependencyType: dependency_1.DependencyType.CONFIG_TAG_REF,
                location: 'parameter.configTagId'
            });
        }
    }
    // 6. Template 참조 (커스텀 템플릿 태그)
    // GTM에서 커스텀 템플릿을 사용하는 태그는 type이 "cvt_XXX" 형태
    // templateId 필드는 없고, type 자체가 템플릿 식별자 역할
    if (tag.type?.startsWith('cvt_')) {
        dependencies.push({
            targetId: `cvt:${tag.type}`, // cvt: prefix로 템플릿 type 참조 표시
            targetType: gtm_1.EntityType.TEMPLATE,
            dependencyType: dependency_1.DependencyType.TEMPLATE_PARAM,
            location: 'type',
            note: `Custom template type: ${tag.type}`
        });
    }
    return dependencies;
}
// ==================== Trigger Parser ====================
/**
 * 트리거에서 의존성 추출
 */
function extractTriggerDependencies(trigger) {
    const dependencies = [];
    // 1. Parameters
    if (trigger.parameter) {
        const paramDeps = extractParameterDependencies(trigger.parameter, 'parameter');
        dependencies.push(...paramDeps);
    }
    // 2. Filter
    if (trigger.filter) {
        const filterDeps = extractFilterDependencies(trigger.filter, 'filter');
        dependencies.push(...filterDeps);
    }
    // 3. Auto Event Filter
    if (trigger.autoEventFilter) {
        const autoFilterDeps = extractFilterDependencies(trigger.autoEventFilter, 'autoEventFilter');
        dependencies.push(...autoFilterDeps);
    }
    // 4. Custom Event Filter
    if (trigger.customEventFilter) {
        const customFilterDeps = extractFilterDependencies(trigger.customEventFilter, 'customEventFilter');
        dependencies.push(...customFilterDeps);
    }
    return dependencies;
}
// ==================== Variable Parser ====================
/**
 * 변수에서 의존성 추출
 */
function extractVariableDependencies(variable) {
    const dependencies = [];
    // 1. Parameters
    if (variable.parameter) {
        const paramDeps = extractParameterDependencies(variable.parameter, 'parameter');
        dependencies.push(...paramDeps);
    }
    // 2. JavaScript 변수 내부 참조 (jsm 타입)
    if (variable.type === 'jsm') {
        const jsCode = variable.parameter?.find(p => p.key === 'javascript')?.value;
        if (jsCode) {
            const jsDeps = extractJsInternalReferences(jsCode);
            dependencies.push(...jsDeps);
        }
    }
    // 3. Lookup Table (smm 타입)
    if (variable.type === 'smm') {
        const lookupDeps = extractLookupTableDependencies(variable);
        dependencies.push(...lookupDeps);
    }
    // 4. Regex Table (remm 타입)
    if (variable.type === 'remm') {
        const regexDeps = extractRegexTableDependencies(variable);
        dependencies.push(...regexDeps);
    }
    return dependencies;
}
// ==================== Helper Functions ====================
/**
 * Parameter 배열에서 변수 참조 추출
 */
function extractParameterDependencies(parameters, basePath) {
    const dependencies = [];
    for (const param of parameters) {
        const path = `${basePath}.${param.key}`;
        // value에서 {{variable}} 참조 추출
        if (param.value) {
            const varRefs = extractVariableReferences(param.value);
            for (const varName of varRefs) {
                dependencies.push({
                    targetId: `name:${varName}`,
                    targetType: gtm_1.EntityType.VARIABLE,
                    dependencyType: dependency_1.DependencyType.DIRECT_REFERENCE,
                    location: path,
                    variableName: varName
                });
            }
        }
        // 중첩 list
        if (param.list) {
            const listDeps = extractParameterDependencies(param.list, `${path}.list`);
            dependencies.push(...listDeps);
        }
        // 중첩 map
        if (param.map) {
            const mapDeps = extractParameterDependencies(param.map, `${path}.map`);
            dependencies.push(...mapDeps);
        }
    }
    return dependencies;
}
/**
 * Filter 배열에서 변수 참조 추출
 */
function extractFilterDependencies(filters, basePath) {
    const dependencies = [];
    for (let i = 0; i < filters.length; i++) {
        const filter = filters[i];
        const path = `${basePath}[${i}]`;
        for (const param of filter.parameter) {
            if (param.value) {
                const varRefs = extractVariableReferences(param.value);
                for (const varName of varRefs) {
                    dependencies.push({
                        targetId: `name:${varName}`,
                        targetType: gtm_1.EntityType.VARIABLE,
                        dependencyType: dependency_1.DependencyType.TRIGGER_CONDITION,
                        location: `${path}.${param.key}`,
                        variableName: varName
                    });
                }
            }
        }
    }
    return dependencies;
}
/**
 * 텍스트에서 {{variable}} 참조 추출
 */
function extractVariableReferences(text) {
    const pattern = /\{\{([^}]+)\}\}/g;
    const matches = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const varName = match[1].trim();
        if (!matches.includes(varName)) {
            matches.push(varName);
        }
    }
    return matches;
}
/**
 * JavaScript 코드 내부에서 변수 참조 추출
 */
function extractJsInternalReferences(jsCode) {
    const dependencies = [];
    // {{variable}} 패턴
    const varRefs = extractVariableReferences(jsCode);
    for (const varName of varRefs) {
        dependencies.push({
            targetId: `name:${varName}`,
            targetType: gtm_1.EntityType.VARIABLE,
            dependencyType: dependency_1.DependencyType.JS_INTERNAL_REF,
            location: 'javascript',
            variableName: varName,
            note: 'JS 변수 내부 참조'
        });
    }
    return dependencies;
}
/**
 * Lookup Table에서 의존성 추출
 */
function extractLookupTableDependencies(variable) {
    const dependencies = [];
    if (!variable.parameter)
        return dependencies;
    // input 변수
    const inputParam = variable.parameter.find(p => p.key === 'input');
    if (inputParam?.value) {
        const varRefs = extractVariableReferences(inputParam.value);
        for (const varName of varRefs) {
            dependencies.push({
                targetId: `name:${varName}`,
                targetType: gtm_1.EntityType.VARIABLE,
                dependencyType: dependency_1.DependencyType.LOOKUP_INPUT,
                location: 'parameter.input',
                variableName: varName
            });
        }
    }
    // map 내 output 값들
    const mapParam = variable.parameter.find(p => p.key === 'map');
    if (mapParam?.list) {
        for (const item of mapParam.list) {
            if (item.map) {
                const outputParam = item.map.find(m => m.key === 'value');
                if (outputParam?.value) {
                    const varRefs = extractVariableReferences(outputParam.value);
                    for (const varName of varRefs) {
                        dependencies.push({
                            targetId: `name:${varName}`,
                            targetType: gtm_1.EntityType.VARIABLE,
                            dependencyType: dependency_1.DependencyType.LOOKUP_OUTPUT,
                            location: 'parameter.map.value',
                            variableName: varName
                        });
                    }
                }
            }
        }
    }
    return dependencies;
}
/**
 * Regex Table에서 의존성 추출
 */
function extractRegexTableDependencies(variable) {
    const dependencies = [];
    if (!variable.parameter)
        return dependencies;
    // input 변수
    const inputParam = variable.parameter.find(p => p.key === 'input');
    if (inputParam?.value) {
        const varRefs = extractVariableReferences(inputParam.value);
        for (const varName of varRefs) {
            dependencies.push({
                targetId: `name:${varName}`,
                targetType: gtm_1.EntityType.VARIABLE,
                dependencyType: dependency_1.DependencyType.LOOKUP_INPUT,
                location: 'parameter.input',
                variableName: varName
            });
        }
    }
    return dependencies;
}
/**
 * 변수 타입 정보 반환
 */
function getVariableTypeInfo(type) {
    const typeMap = {
        'v': { name: 'Data Layer Variable', icon: 'v', hasInternalRefs: false },
        'jsm': { name: 'Custom JavaScript', icon: 'jsm', hasInternalRefs: true },
        'c': { name: 'Constant', icon: 'c', hasInternalRefs: false },
        'smm': { name: 'Lookup Table', icon: 'smm', hasInternalRefs: true },
        'remm': { name: 'Regex Table', icon: 'remm', hasInternalRefs: true },
        'd': { name: 'DOM Element', icon: 'd', hasInternalRefs: false },
        'k': { name: '1st Party Cookie', icon: 'k', hasInternalRefs: false },
        'u': { name: 'URL Variable', icon: 'u', hasInternalRefs: false },
        'aev': { name: 'Auto-Event Variable', icon: 'aev', hasInternalRefs: false },
        'gas': { name: 'Google Analytics Settings', icon: 'gas', hasInternalRefs: true }
    };
    return typeMap[type] || { name: type, icon: '?', hasInternalRefs: false };
}
// ==================== Event-based Reverse Tracking ====================
/**
 * CustomEvent 트리거에서 감지하는 이벤트 이름 추출
 */
function extractCustomEventName(trigger) {
    // customEvent 타입만 처리
    if (trigger.type !== 'customEvent')
        return null;
    // customEventFilter에서 event 조건 찾기
    if (trigger.customEventFilter) {
        for (const filter of trigger.customEventFilter) {
            const arg0 = filter.parameter.find(p => p.key === 'arg0');
            const arg1 = filter.parameter.find(p => p.key === 'arg1');
            // arg0이 {{_event}}이고 arg1이 이벤트명
            if (arg0?.value === '{{_event}}' && arg1?.value) {
                return arg1.value;
            }
        }
    }
    return null;
}
/**
 * HTML 태그 또는 Custom Template에서 dataLayer.push 이벤트 추출
 */
function extractPushedEvents(tag) {
    const events = [];
    // 1. HTML 태그 (html 타입)
    if (tag.type === 'html') {
        const htmlParam = tag.parameter?.find(p => p.key === 'html');
        if (htmlParam?.value) {
            events.push(...extractDataLayerPushEvents(htmlParam.value));
        }
    }
    // 2. Custom Template 태그 - 알려진 템플릿 이벤트 매핑 사용
    const templateEvents = (0, known_event_pushers_1.extractTemplateEvents)(tag);
    events.push(...templateEvents);
    // 중복 제거
    return [...new Set(events)];
}
/**
 * 코드에서 dataLayer.push({ event: "xxx" }) 패턴 추출
 */
function extractDataLayerPushEvents(code) {
    const events = [];
    // 패턴 1: dataLayer.push({ event: "eventName" })
    // 패턴 2: dataLayer.push({ "event": "eventName" })
    // 패턴 3: dataLayer.push({ 'event': 'eventName' })
    // 패턴 4: 멀티라인 지원
    const pattern = /dataLayer\.push\s*\(\s*\{[^}]*["']?event["']?\s*:\s*["']([^"']+)["']/gi;
    let match;
    while ((match = pattern.exec(code)) !== null) {
        const eventName = match[1];
        // 변수 참조 {{...}} 제외 (동적 이벤트는 추적 불가)
        if (!eventName.includes('{{') && !events.includes(eventName)) {
            events.push(eventName);
        }
    }
    return events;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2Vycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9kZXBlbmRlbmN5LXJlc29sdmVyL3BhcnNlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7QUFrQkgsd0RBNEZDO0FBT0QsZ0VBNEJDO0FBT0Qsa0VBK0JDO0FBbU1ELGtEQW1CQztBQU9ELHdEQWlCQztBQUtELGtEQWlCQztBQXpiRCxzQ0FPc0I7QUFDdEIsb0RBQXFFO0FBQ3JFLCtEQUE4RDtBQUU5RCx1REFBdUQ7QUFFdkQ7O0dBRUc7QUFDSCxTQUFnQixzQkFBc0IsQ0FBQyxHQUFXO0lBQ2hELE1BQU0sWUFBWSxHQUFxQixFQUFFLENBQUM7SUFFMUMscUJBQXFCO0lBQ3JCLElBQUksR0FBRyxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ3hCLEtBQUssTUFBTSxTQUFTLElBQUksR0FBRyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzVDLFlBQVksQ0FBQyxJQUFJLENBQUM7Z0JBQ2hCLFFBQVEsRUFBRSxTQUFTO2dCQUNuQixVQUFVLEVBQUUsZ0JBQVUsQ0FBQyxPQUFPO2dCQUM5QixjQUFjLEVBQUUsMkJBQWMsQ0FBQyxjQUFjO2dCQUM3QyxRQUFRLEVBQUUsaUJBQWlCO2FBQzVCLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDO0lBRUQsdUJBQXVCO0lBQ3ZCLElBQUksR0FBRyxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDMUIsS0FBSyxNQUFNLFNBQVMsSUFBSSxHQUFHLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUM5QyxZQUFZLENBQUMsSUFBSSxDQUFDO2dCQUNoQixRQUFRLEVBQUUsU0FBUztnQkFDbkIsVUFBVSxFQUFFLGdCQUFVLENBQUMsT0FBTztnQkFDOUIsY0FBYyxFQUFFLDJCQUFjLENBQUMsZ0JBQWdCO2dCQUMvQyxRQUFRLEVBQUUsbUJBQW1CO2FBQzlCLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDO0lBRUQsZ0JB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QUUsQ0FBQztZQUNyQixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsMEJBQTBCLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDOUQsQ0FBQztJQUNILENBQUM7SUFFRCw0Q0FBNEM7SUFDNUMsTUFBTSxjQUFjLEdBQUcsSUFBQSwyQ0FBcUIsRUFBQyxHQUFHLENBQUMsQ0FBQztJQUNsRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsY0FBYyxDQUFDLENBQUM7SUFFL0IsUUFBUTtJQUNSLE9BQU8sQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDOUIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUywwQkFBMEIsQ0FBQyxJQUFZO0lBQzlDLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztJQUU1QiwrQ0FBK0M7SUFDL0MsaURBQWlEO0lBQ2pELGlEQUFpRDtJQUNqRCxnQkFBZ0I7SUFDaEIsTUFBTSxPQUFPLEdBQUcsd0VBQXdFLENBQUM7SUFFekYsSUFBSSxLQUFLLENBQUM7SUFDVixPQUFPLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUM3QyxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0IsbUNBQW1DO1FBQ25DLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQzdELE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDekIsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEdUTSBFbnRpdHkgUGFyc2Vyc1xyXG4gKiDtg5zqt7gv7Yq466as6rGwL+uzgOyImOyXkOyEnCDsnZjsobTshLEg7LC47KGwIOy2lOy2nFxyXG4gKi9cclxuXHJcbmltcG9ydCB7XHJcbiAgRW50aXR5VHlwZSxcclxuICBHVE1UYWcsXHJcbiAgR1RNVHJpZ2dlcixcclxuICBHVE1WYXJpYWJsZSxcclxuICBHVE1QYXJhbWV0ZXIsXHJcbiAgR1RNRmlsdGVyXHJcbn0gZnJvbSAnLi4vdHlwZXMvZ3RtJztcclxuaW1wb3J0IHsgRGVwZW5kZW5jeUVkZ2UsIERlcGVuZGVuY3lUeXBlIH0gZnJvbSAnLi4vdHlwZXMvZGVwZW5kZW5jeSc7XHJcbmltcG9ydCB7IGV4dHJhY3RUZW1wbGF0ZUV2ZW50cyB9IGZyb20gJy4va25vd24tZXZlbnQtcHVzaGVycyc7XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBUYWcgUGFyc2VyID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICog7YOc6re47JeQ7IScIOydmOyhtOyEsSDstpTstpxcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0VGFnRGVwZW5kZW5jaWVzKHRhZzogR1RNVGFnKTogRGVwZW5kZW5jeUVkZ2VbXSB7XHJcbiAgY29uc3QgZGVwZW5kZW5jaWVzOiBEZXBlbmRlbmN5RWRnZVtdID0gW107XHJcblxyXG4gIC8vIDEuIEZpcmluZyBUcmlnZ2Vyc1xyXG4gIGlmICh0YWcuZmlyaW5nVHJpZ2dlcklkKSB7XHJcbiAgICBmb3IgKGNvbnN0IHRyaWdnZXJJZCBvZiB0YWcuZmlyaW5nVHJpZ2dlcklkKSB7XHJcbiAgICAgIGRlcGVuZGVuY2llcy5wdXNoKHtcclxuICAgICAgICB0YXJnZXRJZDogdHJpZ2dlcklkLFxyXG4gICAgICAgIHRhcmdldFR5cGU6IEVudGl0eVR5cGUuVFJJR0dFUixcclxuICAgICAgICBkZXBlbmRlbmN5VHlwZTogRGVwZW5kZW5jeVR5cGUuRklSSU5HX1RSSUdHRVIsXHJcbiAgICAgICAgbG9jYXRpb246ICdmaXJpbmdUcmlnZ2VySWQnXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gMi4gQmxvY2tpbmcgVHJpZ2dlcnNcclxuICBpZiAodGFnLmJsb2NraW5nVHJpZ2dlcklkKSB7XHJcbiAgICBmb3IgKGNvbnN0IHRyaWdnZXJJZCBvZiB0YWcuYmxvY2tpbmdUcmlnZ2VySWQpIHtcclxuICAgICAgZGVwZW5kZW5jaWVzLnB1c2goe1xyXG4gICAgICAgIHRhcmdldElkOiB0cmlnZ2VySWQsXHJcbiAgICAgICAgdGFyZ2V0VHlwZTogRW50aXR5VHlwZS5UUklHR0VSLFxyXG4gICAgICAgIGRlcGVuZGVuY3lUeXBlOiBEZXBlbmRlbmN5VHlwZS5CTE9DS0lOR19UUklHR0VSLFxyXG4gICAgICAgIGxvY2F0aW9uOiAnYmxvY2tpbmdUcmlnZ2VySWQnXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gMy4gU2V0dXAgVGFnc1xyXG4gIGlmICh0YWcuc2V0dXBUYWcpIHtcclxuICAgIGZvciAoY29uc3Qgc2V0dXAgb2YgdGFnLnNldHVwVGFnKSB7XHJcbiAgICAgIC8vIHRhZ0lk6rCAIOyeiOycvOuptCDsgqzsmqksIOyXhuycvOuptCB0YWdOYW1l7Jy866GcIG5hbWU6IO2YleyLnSDsgqzsmqlcclxuICAgICAgY29uc3QgdGFyZ2V0SWQgPSBzZXR1cC50YWdJZCB8fCAoc2V0dXAudGFnTmFtZSA/IGBuYW1lOiR7c2V0dXAudGFnTmFtZX1gIDogdW5kZWZpbmVkKTtcclxuICAgICAgaWYgKHRhcmdldElkKSB7XHJcbiAgICAgICAgZGVwZW5kZW5jaWVzLnB1c2goe1xyXG4gICAgICAgICAgdGFyZ2V0SWQsXHJcbiAgICAgICAgICB0YXJnZXRUeXBlOiBFbnRpdHlUeXBlLlRBRyxcclxuICAgICAgICAgIGRlcGVuZGVuY3lUeXBlOiBEZXBlbmRlbmN5VHlwZS5TRVRVUF9UQUcsXHJcbiAgICAgICAgICBsb2NhdGlvbjogJ3NldHVwVGFnJyxcclxuICAgICAgICAgIHRhZ05hbWU6IHNldHVwLnRhZ05hbWVcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gNC4gVGVhcmRvd24gVGFnc1xyXG4gIGlmICh0YWcudGVhcmRvd25UYWcpIHtcclxuICAgIGZvciAoY29uc3QgdGVhcmRvd24gb2YgdGFnLnRlYXJkb3duVGFnKSB7XHJcbiAgICAgIC8vIHRhZ0lk6rCAIOyeiOycvOuptCDsgqzsmqksIOyXhuycvOuptCB0YWdOYW1l7Jy866GcIG5hbWU6IO2YleyLnSDsgqzsmqlcclxuICAgICAgY29uc3QgdGFyZ2V0SWQgPSB0ZWFyZG93bi50YWdJZCB8fCAodGVhcmRvd24udGFnTmFtZSA/IGBuYW1lOiR7dGVhcmRvd24udGFnTmFtZX1gIDogdW5kZWZpbmVkKTtcclxuICAgICAgaWYgKHRhcmdldElkKSB7XHJcbiAgICAgICAgZGVwZW5kZW5jaWVzLnB1c2goe1xyXG4gICAgICAgICAgdGFyZ2V0SWQsXHJcbiAgICAgICAgICB0YXJnZXRUeXBlOiBFbnRpdHlUeXBlLlRBRyxcclxuICAgICAgICAgIGRlcGVuZGVuY3lUeXBlOiBEZXBlbmRlbmN5VHlwZS5URUFSRE9XTl9UQUcsXHJcbiAgICAgICAgICBsb2NhdGlvbjogJ3RlYXJkb3duVGFnJyxcclxuICAgICAgICAgIHRhZ05hbWU6IHRlYXJkb3duLnRhZ05hbWVcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gNS4gUGFyYW1ldGVycyAo67OA7IiYIOywuOyhsClcclxuICBpZiAodGFnLnBhcmFtZXRlcikge1xyXG4gICAgY29uc3QgcGFyYW1EZXBzID0gZXh0cmFjdFBhcmFtZXRlckRlcGVuZGVuY2llcyh0YWcucGFyYW1ldGVyLCAncGFyYW1ldGVyJyk7XHJcbiAgICBkZXBlbmRlbmNpZXMucHVzaCguLi5wYXJhbURlcHMpO1xyXG5cclxuICAgIC8vIEdBNCBDb25maWcgVGFnIOywuOyhsCAoY29uZmlnVGFnSWQpXHJcbiAgICBjb25zdCBjb25maWdUYWdQYXJhbSA9IHRhZy5wYXJhbWV0ZXIuZmluZChwID0+IHAua2V5ID09PSAnY29uZmlnVGFnSWQnKTtcclxuICAgIGlmIChjb25maWdUYWdQYXJhbT8udmFsdWUpIHtcclxuICAgICAgZGVwZW5kZW5jaWVzLnB1c2goe1xyXG4gICAgICAgIHRhcmdldElkOiBjb25maWdUYWdQYXJhbS52YWx1ZSxcclxuICAgICAgICB0YXJnZXRUeXBlOiBFbnRpdHlUeXBlLlRBRyxcclxuICAgICAgICBkZXBlbmRlbmN5VHlwZTogRGVwZW5kZW5jeVR5cGUuQ09ORklHX1RBR19SRUYsXHJcbiAgICAgICAgbG9jYXRpb246ICdwYXJhbWV0ZXIuY29uZmlnVGFnSWQnXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gNi4gVGVtcGxhdGUg7LC47KGwICjsu6TsiqTthYAg7YWc7ZSM66a/IO2DnOq3uClcclxuICAvLyBHVE3sl5DshJwg7Luk7Iqk7YWAIO2FnO2UjOumv+ydhCDsgqzsmqntlZjripQg7YOc6re464qUIHR5cGXsnbQgXCJjdnRfWFhYXCIg7ZiV7YOcXHJcbiAgLy8gdGVtcGxhdGVJZCDtlYTrk5zripQg7JeG6rOgLCB0eXBlIOyekOyytOqwgCDthZztlIzrpr8g7Iud67OE7J6QIOyXre2VoFxyXG4gIGlmICh0YWcudHlwZT8uc3RhcnRzV2l0aCgnY3Z0XycpKSB7XHJcbiAgICBkZXBlbmRlbmNpZXMucHVzaCh7XHJcbiAgICAgIHRhcmdldElkOiBgY3Z0OiR7dGFnLnR5cGV9YCwgIC8vIGN2dDogcHJlZml466GcIO2FnO2UjOumvyB0eXBlIOywuOyhsCDtkZzsi5xcclxuICAgICAgdGFyZ2V0VHlwZTogRW50aXR5VHlwZS5URU1QTEFURSxcclxuICAgICAgZGVwZW5kZW5jeVR5cGU6IERlcGVuZGVuY3lUeXBlLlRFTVBMQVRFX1BBUkFNLFxyXG4gICAgICBsb2NhdGlvbjogJ3R5cGUnLFxyXG4gICAgICBub3RlOiBgQ3VzdG9tIHRlbXBsYXRlIHR5cGU6ICR7dGFnLnR5cGV9YFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZGVwZW5kZW5jaWVzO1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBUcmlnZ2VyIFBhcnNlciA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIO2KuOumrOqxsOyXkOyEnCDsnZjsobTshLEg7LaU7LacXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFRyaWdnZXJEZXBlbmRlbmNpZXModHJpZ2dlcjogR1RNVHJpZ2dlcik6IERlcGVuZGVuY3lFZGdlW10ge1xyXG4gIGNvbnN0IGRlcGVuZGVuY2llczogRGVwZW5kZW5jeUVkZ2VbXSA9IFtdO1xyXG5cclxuICAvLyAxLiBQYXJhbWV0ZXJzXHJcbiAgaWYgKHRyaWdnZXIucGFyYW1ldGVyKSB7XHJcbiAgICBjb25zdCBwYXJhbURlcHMgPSBleHRyYWN0UGFyYW1ldGVyRGVwZW5kZW5jaWVzKHRyaWdnZXIucGFyYW1ldGVyLCAncGFyYW1ldGVyJyk7XHJcbiAgICBkZXBlbmRlbmNpZXMucHVzaCguLi5wYXJhbURlcHMpO1xyXG4gIH1cclxuXHJcbiAgLy8gMi4gRmlsdGVyXHJcbiAgaWYgKHRyaWdnZXIuZmlsdGVyKSB7XHJcbiAgICBjb25zdCBmaWx0ZXJEZXBzID0gZXh0cmFjdEZpbHRlckRlcGVuZGVuY2llcyh0cmlnZ2VyLmZpbHRlciwgJ2ZpbHRlcicpO1xyXG4gICAgZGVwZW5kZW5jaWVzLnB1c2goLi4uZmlsdGVyRGVwcyk7XHJcbiAgfVxyXG5cclxuICAvLyAzLiBBdXRvIEV2ZW50IEZpbHRlclxyXG4gIGlmICh0cmlnZ2VyLmF1dG9FdmVudEZpbHRlcikge1xyXG4gICAgY29uc3QgYXV0b0ZpbHRlckRlcHMgPSBleHRyYWN0RmlsdGVyRGVwZW5kZW5jaWVzKHRyaWdnZXIuYXV0b0V2ZW50RmlsdGVyLCAnYXV0b0V2ZW50RmlsdGVyJyk7XHJcbiAgICBkZXBlbmRlbmNpZXMucHVzaCguLi5hdXRvRmlsdGVyRGVwcyk7XHJcbiAgfVxyXG5cclxuICAvLyA0LiBDdXN0b20gRXZlbnQgRmlsdGVyXHJcbiAgaWYgKHRyaWdnZXIuY3VzdG9tRXZlbnRGaWx0ZXIpIHtcclxuICAgIGNvbnN0IGN1c3RvbUZpbHRlckRlcHMgPSBleHRyYWN0RmlsdGVyRGVwZW5kZW5jaWVzKHRyaWdnZXIuY3VzdG9tRXZlbnRGaWx0ZXIsICdjdXN0b21FdmVudEZpbHRlcicpO1xyXG4gICAgZGVwZW5kZW5jaWVzLnB1c2goLi4uY3VzdG9tRmlsdGVyRGVwcyk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZGVwZW5kZW5jaWVzO1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBWYXJpYWJsZSBQYXJzZXIgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiDrs4DsiJjsl5DshJwg7J2Y7KG07ISxIOy2lOy2nFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RWYXJpYWJsZURlcGVuZGVuY2llcyh2YXJpYWJsZTogR1RNVmFyaWFibGUpOiBEZXBlbmRlbmN5RWRnZVtdIHtcclxuICBjb25zdCBkZXBlbmRlbmNpZXM6IERlcGVuZGVuY3lFZGdlW10gPSBbXTtcclxuXHJcbiAgLy8gMS4gUGFyYW1ldGVyc1xyXG4gIGlmICh2YXJpYWJsZS5wYXJhbWV0ZXIpIHtcclxuICAgIGNvbnN0IHBhcmFtRGVwcyA9IGV4dHJhY3RQYXJhbWV0ZXJEZXBlbmRlbmNpZXModmFyaWFibGUucGFyYW1ldGVyLCAncGFyYW1ldGVyJyk7XHJcbiAgICBkZXBlbmRlbmNpZXMucHVzaCguLi5wYXJhbURlcHMpO1xyXG4gIH1cclxuXHJcbiAgLy8gMi4gSmF2YVNjcmlwdCDrs4DsiJgg64K067aAIOywuOyhsCAoanNtIO2DgOyehSlcclxuICBpZiAodmFyaWFibGUudHlwZSA9PT0gJ2pzbScpIHtcclxuICAgIGNvbnN0IGpzQ29kZSA9IHZhcmlhYmxlLnBhcmFtZXRlcj8uZmluZChwID0+IHAua2V5ID09PSAnamF2YXNjcmlwdCcpPy52YWx1ZTtcclxuICAgIGlmIChqc0NvZGUpIHtcclxuICAgICAgY29uc3QganNEZXBzID0gZXh0cmFjdEpzSW50ZXJuYWxSZWZlcmVuY2VzKGpzQ29kZSk7XHJcbiAgICAgIGRlcGVuZGVuY2llcy5wdXNoKC4uLmpzRGVwcyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyAzLiBMb29rdXAgVGFibGUgKHNtbSDtg4DsnoUpXHJcbiAgaWYgKHZhcmlhYmxlLnR5cGUgPT09ICdzbW0nKSB7XHJcbiAgICBjb25zdCBsb29rdXBEZXBzID0gZXh0cmFjdExvb2t1cFRhYmxlRGVwZW5kZW5jaWVzKHZhcmlhYmxlKTtcclxuICAgIGRlcGVuZGVuY2llcy5wdXNoKC4uLmxvb2t1cERlcHMpO1xyXG4gIH1cclxuXHJcbiAgLy8gNC4gUmVnZXggVGFibGUgKHJlbW0g7YOA7J6FKVxyXG4gIGlmICh2YXJpYWJsZS50eXBlID09PSAncmVtbScpIHtcclxuICAgIGNvbnN0IHJlZ2V4RGVwcyA9IGV4dHJhY3RSZWdleFRhYmxlRGVwZW5kZW5jaWVzKHZhcmlhYmxlKTtcclxuICAgIGRlcGVuZGVuY2llcy5wdXNoKC4uLnJlZ2V4RGVwcyk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZGVwZW5kZW5jaWVzO1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PSBIZWxwZXIgRnVuY3Rpb25zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogUGFyYW1ldGVyIOuwsOyXtOyXkOyEnCDrs4DsiJgg7LC47KGwIOy2lOy2nFxyXG4gKi9cclxuZnVuY3Rpb24gZXh0cmFjdFBhcmFtZXRlckRlcGVuZGVuY2llcyhcclxuICBwYXJhbWV0ZXJzOiBHVE1QYXJhbWV0ZXJbXSxcclxuICBiYXNlUGF0aDogc3RyaW5nXHJcbik6IERlcGVuZGVuY3lFZGdlW10ge1xyXG4gIGNvbnN0IGRlcGVuZGVuY2llczogRGVwZW5kZW5jeUVkZ2VbXSA9IFtdO1xyXG5cclxuICBmb3IgKGNvbnN0IHBhcmFtIG9mIHBhcmFtZXRlcnMpIHtcclxuICAgIGNvbnN0IHBhdGggPSBgJHtiYXNlUGF0aH0uJHtwYXJhbS5rZXl9YDtcclxuXHJcbiAgICAvLyB2YWx1ZeyXkOyEnCB7e3ZhcmlhYmxlfX0g7LC47KGwIOy2lOy2nFxyXG4gICAgaWYgKHBhcmFtLnZhbHVlKSB7XHJcbiAgICAgIGNvbnN0IHZhclJlZnMgPSBleHRyYWN0VmFyaWFibGVSZWZlcmVuY2VzKHBhcmFtLnZhbHVlKTtcclxuICAgICAgZm9yIChjb25zdCB2YXJOYW1lIG9mIHZhclJlZnMpIHtcclxuICAgICAgICBkZXBlbmRlbmNpZXMucHVzaCh7XHJcbiAgICAgICAgICB0YXJnZXRJZDogYG5hbWU6JHt2YXJOYW1lfWAsXHJcbiAgICAgICAgICB0YXJnZXRUeXBlOiBFbnRpdHlUeXBlLlZBUklBQkxFLFxyXG4gICAgICAgICAgZGVwZW5kZW5jeVR5cGU6IERlcGVuZGVuY3lUeXBlLkRJUkVDVF9SRUZFUkVOQ0UsXHJcbiAgICAgICAgICBsb2NhdGlvbjogcGF0aCxcclxuICAgICAgICAgIHZhcmlhYmxlTmFtZTogdmFyTmFtZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8g7KSR7LKpIGxpc3RcclxuICAgIGlmIChwYXJhbS5saXN0KSB7XHJcbiAgICAgIGNvbnN0IGxpc3REZXBzID0gZXh0cmFjdFBhcmFtZXRlckRlcGVuZGVuY2llcyhwYXJhbS5saXN0LCBgJHtwYXRofS5saXN0YCk7XHJcbiAgICAgIGRlcGVuZGVuY2llcy5wdXNoKC4uLmxpc3REZXBzKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyDspJHssqkgbWFwXHJcbiAgICBpZiAocGFyYW0ubWFwKSB7XHJcbiAgICAgIGNvbnN0IG1hcERlcHMgPSBleHRyYWN0UGFyYW1ldGVyRGVwZW5kZW5jaWVzKHBhcmFtLm1hcCwgYCR7cGF0aH0ubWFwYCk7XHJcbiAgICAgIGRlcGVuZGVuY2llcy5wdXNoKC4uLm1hcERlcHMpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGRlcGVuZGVuY2llcztcclxufVxyXG5cclxuLyoqXHJcbiAqIEZpbHRlciDrsLDsl7Tsl5DshJwg67OA7IiYIOywuOyhsCDstpTstpxcclxuICovXHJcbmZ1bmN0aW9uIGV4dHJhY3RGaWx0ZXJEZXBlbmRlbmNpZXMoXHJcbiAgZmlsdGVyczogR1RNRmlsdGVyW10sXHJcbiAgYmFzZVBhdGg6IHN0cmluZ1xyXG4pOiBEZXBlbmRlbmN5RWRnZVtdIHtcclxuICBjb25zdCBkZXBlbmRlbmNpZXM6IERlcGVuZGVuY3lFZGdlW10gPSBbXTtcclxuXHJcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWx0ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBjb25zdCBmaWx0ZXIgPSBmaWx0ZXJzW2ldO1xyXG4gICAgY29uc3QgcGF0aCA9IGAke2Jhc2VQYXRofVske2l9XWA7XHJcblxyXG4gICAgZm9yIChjb25zdCBwYXJhbSBvZiBmaWx0ZXIucGFyYW1ldGVyKSB7XHJcbiAgICAgIGlmIChwYXJhbS52YWx1ZSkge1xyXG4gICAgICAgIGNvbnN0IHZhclJlZnMgPSBleHRyYWN0VmFyaWFibGVSZWZlcmVuY2VzKHBhcmFtLnZhbHVlKTtcclxuICAgICAgICBmb3IgKGNvbnN0IHZhck5hbWUgb2YgdmFyUmVmcykge1xyXG4gICAgICAgICAgZGVwZW5kZW5jaWVzLnB1c2goe1xyXG4gICAgICAgICAgICB0YXJnZXRJZDogYG5hbWU6JHt2YXJOYW1lfWAsXHJcbiAgICAgICAgICAgIHRhcmdldFR5cGU6IEVudGl0eVR5cGUuVkFSSUFCTEUsXHJcbiAgICAgICAgICAgIGRlcGVuZGVuY3lUeXBlOiBEZXBlbmRlbmN5VHlwZS5UUklHR0VSX0NPTkRJVElPTixcclxuICAgICAgICAgICAgbG9jYXRpb246IGAke3BhdGh9LiR7cGFyYW0ua2V5fWAsXHJcbiAgICAgICAgICAgIHZhcmlhYmxlTmFtZTogdmFyTmFtZVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZGVwZW5kZW5jaWVzO1xyXG59XHJcblxyXG4vKipcclxuICog7YWN7Iqk7Yq47JeQ7IScIHt7dmFyaWFibGV9fSDssLjsobAg7LaU7LacXHJcbiAqL1xyXG5mdW5jdGlvbiBleHRyYWN0VmFyaWFibGVSZWZlcmVuY2VzKHRleHQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcclxuICBjb25zdCBwYXR0ZXJuID0gL1xce1xceyhbXn1dKylcXH1cXH0vZztcclxuICBjb25zdCBtYXRjaGVzOiBzdHJpbmdbXSA9IFtdO1xyXG4gIGxldCBtYXRjaDtcclxuXHJcbiAgd2hpbGUgKChtYXRjaCA9IHBhdHRlcm4uZXhlYyh0ZXh0KSkgIT09IG51bGwpIHtcclxuICAgIGNvbnN0IHZhck5hbWUgPSBtYXRjaFsxXS50cmltKCk7XHJcbiAgICBpZiAoIW1hdGNoZXMuaW5jbHVkZXModmFyTmFtZSkpIHtcclxuICAgICAgbWF0Y2hlcy5wdXNoKHZhck5hbWUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG1hdGNoZXM7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBKYXZhU2NyaXB0IOy9lOuTnCDrgrTrtoDsl5DshJwg67OA7IiYIOywuOyhsCDstpTstpxcclxuICovXHJcbmZ1bmN0aW9uIGV4dHJhY3RKc0ludGVybmFsUmVmZXJlbmNlcyhqc0NvZGU6IHN0cmluZyk6IERlcGVuZGVuY3lFZGdlW10ge1xyXG4gIGNvbnN0IGRlcGVuZGVuY2llczogRGVwZW5kZW5jeUVkZ2VbXSA9IFtdO1xyXG5cclxuICAvLyB7e3ZhcmlhYmxlfX0g7Yyo7YS0XHJcbiAgY29uc3QgdmFyUmVmcyA9IGV4dHJhY3RWYXJpYWJsZVJlZmVyZW5jZXMoanNDb2RlKTtcclxuICBmb3IgKGNvbnN0IHZhck5hbWUgb2YgdmFyUmVmcykge1xyXG4gICAgZGVwZW5kZW5jaWVzLnB1c2goe1xyXG4gICAgICB0YXJnZXRJZDogYG5hbWU6JHt2YXJOYW1lfWAsXHJcbiAgICAgIHRhcmdldFR5cGU6IEVudGl0eVR5cGUuVkFSSUFCTEUsXHJcbiAgICAgIGRlcGVuZGVuY3lUeXBlOiBEZXBlbmRlbmN5VHlwZS5KU19JTlRFUk5BTF9SRUYsXHJcbiAgICAgIGxvY2F0aW9uOiAnamF2YXNjcmlwdCcsXHJcbiAgICAgIHZhcmlhYmxlTmFtZTogdmFyTmFtZSxcclxuICAgICAgbm90ZTogJ0pTIOuzgOyImCDrgrTrtoAg7LC47KGwJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZGVwZW5kZW5jaWVzO1xyXG59XHJcblxyXG4vKipcclxuICogTG9va3VwIFRhYmxl7JeQ7IScIOydmOyhtOyEsSDstpTstpxcclxuICovXHJcbmZ1bmN0aW9uIGV4dHJhY3RMb29rdXBUYWJsZURlcGVuZGVuY2llcyh2YXJpYWJsZTogR1RNVmFyaWFibGUpOiBEZXBlbmRlbmN5RWRnZVtdIHtcclxuICBjb25zdCBkZXBlbmRlbmNpZXM6IERlcGVuZGVuY3lFZGdlW10gPSBbXTtcclxuXHJcbiAgaWYgKCF2YXJpYWJsZS5wYXJhbWV0ZXIpIHJldHVybiBkZXBlbmRlbmNpZXM7XHJcblxyXG4gIC8vIGlucHV0IOuzgOyImFxyXG4gIGNvbnN0IGlucHV0UGFyYW0gPSB2YXJpYWJsZS5wYXJhbWV0ZXIuZmluZChwID0+IHAua2V5ID09PSAnaW5wdXQnKTtcclxuICBpZiAoaW5wdXRQYXJhbT8udmFsdWUpIHtcclxuICAgIGNvbnN0IHZhclJlZnMgPSBleHRyYWN0VmFyaWFibGVSZWZlcmVuY2VzKGlucHV0UGFyYW0udmFsdWUpO1xyXG4gICAgZm9yIChjb25zdCB2YXJOYW1lIG9mIHZhclJlZnMpIHtcclxuICAgICAgZGVwZW5kZW5jaWVzLnB1c2goe1xyXG4gICAgICAgIHRhcmdldElkOiBgbmFtZToke3Zhck5hbWV9YCxcclxuICAgICAgICB0YXJnZXRUeXBlOiBFbnRpdHlUeXBlLlZBUklBQkxFLFxyXG4gICAgICAgIGRlcGVuZGVuY3lUeXBlOiBEZXBlbmRlbmN5VHlwZS5MT09LVVBfSU5QVVQsXHJcbiAgICAgICAgbG9jYXRpb246ICdwYXJhbWV0ZXIuaW5wdXQnLFxyXG4gICAgICAgIHZhcmlhYmxlTmFtZTogdmFyTmFtZVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIG1hcCDrgrQgb3V0cHV0IOqwkuuTpFxyXG4gIGNvbnN0IG1hcFBhcmFtID0gdmFyaWFibGUucGFyYW1ldGVyLmZpbmQocCA9PiBwLmtleSA9PT0gJ21hcCcpO1xyXG4gIGlmIChtYXBQYXJhbT8ubGlzdCkge1xyXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIG1hcFBhcmFtLmxpc3QpIHtcclxuICAgICAgaWYgKGl0ZW0ubWFwKSB7XHJcbiAgICAgICAgY29uc3Qgb3V0cHV0UGFyYW0gPSBpdGVtLm1hcC5maW5kKG0gPT4gbS5rZXkgPT09ICd2YWx1ZScpO1xyXG4gICAgICAgIGlmIChvdXRwdXRQYXJhbT8udmFsdWUpIHtcclxuICAgICAgICAgIGNvbnN0IHZhclJlZnMgPSBleHRyYWN0VmFyaWFibGVSZWZlcmVuY2VzKG91dHB1dFBhcmFtLnZhbHVlKTtcclxuICAgICAgICAgIGZvciAoY29uc3QgdmFyTmFtZSBvZiB2YXJSZWZzKSB7XHJcbiAgICAgICAgICAgIGRlcGVuZGVuY2llcy5wdXNoKHtcclxuICAgICAgICAgICAgICB0YXJnZXRJZDogYG5hbWU6JHt2YXJOYW1lfWAsXHJcbiAgICAgICAgICAgICAgdGFyZ2V0VHlwZTogRW50aXR5VHlwZS5WQVJJQUJMRSxcclxuICAgICAgICAgICAgICBkZXBlbmRlbmN5VHlwZTogRGVwZW5kZW5jeVR5cGUuTE9PS1VQX09VVFBVVCxcclxuICAgICAgICAgICAgICBsb2NhdGlvbjogJ3BhcmFtZXRlci5tYXAudmFsdWUnLFxyXG4gICAgICAgICAgICAgIHZhcmlhYmxlTmFtZTogdmFyTmFtZVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBkZXBlbmRlbmNpZXM7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWdleCBUYWJsZeyXkOyEnCDsnZjsobTshLEg7LaU7LacXHJcbiAqL1xyXG5mdW5jdGlvbiBleHRyYWN0UmVnZXhUYWJsZURlcGVuZGVuY2llcyh2YXJpYWJsZTogR1RNVmFyaWFibGUpOiBEZXBlbmRlbmN5RWRnZVtdIHtcclxuICBjb25zdCBkZXBlbmRlbmNpZXM6IERlcGVuZGVuY3lFZGdlW10gPSBbXTtcclxuXHJcbiAgaWYgKCF2YXJpYWJsZS5wYXJhbWV0ZXIpIHJldHVybiBkZXBlbmRlbmNpZXM7XHJcblxyXG4gIC8vIGlucHV0IOuzgOyImFxyXG4gIGNvbnN0IGlucHV0UGFyYW0gPSB2YXJpYWJsZS5wYXJhbWV0ZXIuZmluZChwID0+IHAua2V5ID09PSAnaW5wdXQnKTtcclxuICBpZiAoaW5wdXRQYXJhbT8udmFsdWUpIHtcclxuICAgIGNvbnN0IHZhclJlZnMgPSBleHRyYWN0VmFyaWFibGVSZWZlcmVuY2VzKGlucHV0UGFyYW0udmFsdWUpO1xyXG4gICAgZm9yIChjb25zdCB2YXJOYW1lIG9mIHZhclJlZnMpIHtcclxuICAgICAgZGVwZW5kZW5jaWVzLnB1c2goe1xyXG4gICAgICAgIHRhcmdldElkOiBgbmFtZToke3Zhck5hbWV9YCxcclxuICAgICAgICB0YXJnZXRUeXBlOiBFbnRpdHlUeXBlLlZBUklBQkxFLFxyXG4gICAgICAgIGRlcGVuZGVuY3lUeXBlOiBEZXBlbmRlbmN5VHlwZS5MT09LVVBfSU5QVVQsXHJcbiAgICAgICAgbG9jYXRpb246ICdwYXJhbWV0ZXIuaW5wdXQnLFxyXG4gICAgICAgIHZhcmlhYmxlTmFtZTogdmFyTmFtZVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBkZXBlbmRlbmNpZXM7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDrs4DsiJgg7YOA7J6FIOygleuztCDrsJjtmZhcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRWYXJpYWJsZVR5cGVJbmZvKHR5cGU6IHN0cmluZyk6IHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgaWNvbjogc3RyaW5nO1xyXG4gIGhhc0ludGVybmFsUmVmczogYm9vbGVhbjtcclxufSB7XHJcbiAgY29uc3QgdHlwZU1hcDogUmVjb3JkPHN0cmluZywgeyBuYW1lOiBzdHJpbmc7IGljb246IHN0cmluZzsgaGFzSW50ZXJuYWxSZWZzOiBib29sZWFuIH0+ID0ge1xyXG4gICAgJ3YnOiB7IG5hbWU6ICdEYXRhIExheWVyIFZhcmlhYmxlJywgaWNvbjogJ3YnLCBoYXNJbnRlcm5hbFJlZnM6IGZhbHNlIH0sXHJcbiAgICAnanNtJzogeyBuYW1lOiAnQ3VzdG9tIEphdmFTY3JpcHQnLCBpY29uOiAnanNtJywgaGFzSW50ZXJuYWxSZWZzOiB0cnVlIH0sXHJcbiAgICAnYyc6IHsgbmFtZTogJ0NvbnN0YW50JywgaWNvbjogJ2MnLCBoYXNJbnRlcm5hbFJlZnM6IGZhbHNlIH0sXHJcbiAgICAnc21tJzogeyBuYW1lOiAnTG9va3VwIFRhYmxlJywgaWNvbjogJ3NtbScsIGhhc0ludGVybmFsUmVmczogdHJ1ZSB9LFxyXG4gICAgJ3JlbW0nOiB7IG5hbWU6ICdSZWdleCBUYWJsZScsIGljb246ICdyZW1tJywgaGFzSW50ZXJuYWxSZWZzOiB0cnVlIH0sXHJcbiAgICAnZCc6IHsgbmFtZTogJ0RPTSBFbGVtZW50JywgaWNvbjogJ2QnLCBoYXNJbnRlcm5hbFJlZnM6IGZhbHNlIH0sXHJcbiAgICAnayc6IHsgbmFtZTogJzFzdCBQYXJ0eSBDb29raWUnLCBpY29uOiAnaycsIGhhc0ludGVybmFsUmVmczogZmFsc2UgfSxcclxuICAgICd1JzogeyBuYW1lOiAnVVJMIFZhcmlhYmxlJywgaWNvbjogJ3UnLCBoYXNJbnRlcm5hbFJlZnM6IGZhbHNlIH0sXHJcbiAgICAnYWV2JzogeyBuYW1lOiAnQXV0by1FdmVudCBWYXJpYWJsZScsIGljb246ICdhZXYnLCBoYXNJbnRlcm5hbFJlZnM6IGZhbHNlIH0sXHJcbiAgICAnZ2FzJzogeyBuYW1lOiAnR29vZ2xlIEFuYWx5dGljcyBTZXR0aW5ncycsIGljb246ICdnYXMnLCBoYXNJbnRlcm5hbFJlZnM6IHRydWUgfVxyXG4gIH07XHJcblxyXG4gIHJldHVybiB0eXBlTWFwW3R5cGVdIHx8IHsgbmFtZTogdHlwZSwgaWNvbjogJz8nLCBoYXNJbnRlcm5hbFJlZnM6IGZhbHNlIH07XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09IEV2ZW50LWJhc2VkIFJldmVyc2UgVHJhY2tpbmcgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBDdXN0b21FdmVudCDtirjrpqzqsbDsl5DshJwg6rCQ7KeA7ZWY64qUIOydtOuypO2KuCDsnbTrpoQg7LaU7LacXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEN1c3RvbUV2ZW50TmFtZSh0cmlnZ2VyOiBHVE1UcmlnZ2VyKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgLy8gY3VzdG9tRXZlbnQg7YOA7J6F66eMIOyymOumrFxyXG4gIGlmICh0cmlnZ2VyLnR5cGUgIT09ICdjdXN0b21FdmVudCcpIHJldHVybiBudWxsO1xyXG5cclxuICAvLyBjdXN0b21FdmVudEZpbHRlcuyXkOyEnCBldmVudCDsobDqsbQg7LC+6riwXHJcbiAgaWYgKHRyaWdnZXIuY3VzdG9tRXZlbnRGaWx0ZXIpIHtcclxuICAgIGZvciAoY29uc3QgZmlsdGVyIG9mIHRyaWdnZXIuY3VzdG9tRXZlbnRGaWx0ZXIpIHtcclxuICAgICAgY29uc3QgYXJnMCA9IGZpbHRlci5wYXJhbWV0ZXIuZmluZChwID0+IHAua2V5ID09PSAnYXJnMCcpO1xyXG4gICAgICBjb25zdCBhcmcxID0gZmlsdGVyLnBhcmFtZXRlci5maW5kKHAgPT4gcC5rZXkgPT09ICdhcmcxJyk7XHJcblxyXG4gICAgICAvLyBhcmcw7J20IHt7X2V2ZW50fX3snbTqs6AgYXJnMeydtCDsnbTrsqTtirjrqoVcclxuICAgICAgaWYgKGFyZzA/LnZhbHVlID09PSAne3tfZXZlbnR9fScgJiYgYXJnMT8udmFsdWUpIHtcclxuICAgICAgICByZXR1cm4gYXJnMS52YWx1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gbnVsbDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhUTUwg7YOc6re4IOuYkOuKlCBDdXN0b20gVGVtcGxhdGXsl5DshJwgZGF0YUxheWVyLnB1c2gg7J2067Kk7Yq4IOy2lOy2nFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RQdXNoZWRFdmVudHModGFnOiBHVE1UYWcpOiBzdHJpbmdbXSB7XHJcbiAgY29uc3QgZXZlbnRzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICAvLyAxLiBIVE1MIO2DnOq3uCAoaHRtbCDtg4DsnoUpXHJcbiAgaWYgKHRhZy50eXBlID09PSAnaHRtbCcpIHtcclxuICAgIGNvbnN0IGh0bWxQYXJhbSA9IHRhZy5wYXJhbWV0ZXI/LmZpbmQocCA9PiBwLmtleSA9PT0gJ2h0bWwnKTtcclxuICAgIGlmIChodG1sUGFyYW0/LnZhbHVlKSB7XHJcbiAgICAgIGV2ZW50cy5wdXNoKC4uLmV4dHJhY3REYXRhTGF5ZXJQdXNoRXZlbnRzKGh0bWxQYXJhbS52YWx1ZSkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gMi4gQ3VzdG9tIFRlbXBsYXRlIO2DnOq3uCAtIOyVjOugpOynhCDthZztlIzrpr8g7J2067Kk7Yq4IOunpO2VkSDsgqzsmqlcclxuICBjb25zdCB0ZW1wbGF0ZUV2ZW50cyA9IGV4dHJhY3RUZW1wbGF0ZUV2ZW50cyh0YWcpO1xyXG4gIGV2ZW50cy5wdXNoKC4uLnRlbXBsYXRlRXZlbnRzKTtcclxuXHJcbiAgLy8g7KSR67O1IOygnOqxsFxyXG4gIHJldHVybiBbLi4ubmV3IFNldChldmVudHMpXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIOy9lOuTnOyXkOyEnCBkYXRhTGF5ZXIucHVzaCh7IGV2ZW50OiBcInh4eFwiIH0pIO2MqO2EtCDstpTstpxcclxuICovXHJcbmZ1bmN0aW9uIGV4dHJhY3REYXRhTGF5ZXJQdXNoRXZlbnRzKGNvZGU6IHN0cmluZyk6IHN0cmluZ1tdIHtcclxuICBjb25zdCBldmVudHM6IHN0cmluZ1tdID0gW107XHJcblxyXG4gIC8vIO2MqO2EtCAxOiBkYXRhTGF5ZXIucHVzaCh7IGV2ZW50OiBcImV2ZW50TmFtZVwiIH0pXHJcbiAgLy8g7Yyo7YS0IDI6IGRhdGFMYXllci5wdXNoKHsgXCJldmVudFwiOiBcImV2ZW50TmFtZVwiIH0pXHJcbiAgLy8g7Yyo7YS0IDM6IGRhdGFMYXllci5wdXNoKHsgJ2V2ZW50JzogJ2V2ZW50TmFtZScgfSlcclxuICAvLyDtjKjthLQgNDog66mA7Yuw65287J24IOyngOybkFxyXG4gIGNvbnN0IHBhdHRlcm4gPSAvZGF0YUxheWVyXFwucHVzaFxccypcXChcXHMqXFx7W159XSpbXCInXT9ldmVudFtcIiddP1xccyo6XFxzKltcIiddKFteXCInXSspW1wiJ10vZ2k7XHJcblxyXG4gIGxldCBtYXRjaDtcclxuICB3aGlsZSAoKG1hdGNoID0gcGF0dGVybi5leGVjKGNvZGUpKSAhPT0gbnVsbCkge1xyXG4gICAgY29uc3QgZXZlbnROYW1lID0gbWF0Y2hbMV07XHJcbiAgICAvLyDrs4DsiJgg7LC47KGwIHt7Li4ufX0g7KCc7Jm4ICjrj5nsoIEg7J2067Kk7Yq464qUIOy2lOyggSDrtojqsIApXHJcbiAgICBpZiAoIWV2ZW50TmFtZS5pbmNsdWRlcygne3snKSAmJiAhZXZlbnRzLmluY2x1ZGVzKGV2ZW50TmFtZSkpIHtcclxuICAgICAgZXZlbnRzLnB1c2goZXZlbnROYW1lKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBldmVudHM7XHJcbn1cclxuIl19