"use strict";
/**
 * Dependency Graph Builder
 *
 * GTM MCP를 통해 엔티티를 조회하고 의존성 그래프를 구축합니다.
 * - BFS로 전체 의존성 탐색
 * - Topological Sort로 생성 순서 결정
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyGraphBuilder = void 0;
const gtm_1 = require("../types/gtm");
const dependency_1 = require("../types/dependency");
const parsers_1 = require("./parsers");
// ==================== Graph Builder ====================
class DependencyGraphBuilder {
    constructor(adapter) {
        this.nodes = new Map();
        this.visited = new Set();
        this.variableNameCache = new Map();
        this.adapter = adapter;
    }
    /**
     * 태그에서 시작하여 전체 의존성 그래프 구축
     */
    async buildFromTag(tagId) {
        this.reset();
        await this.bfsTraverse(gtm_1.EntityType.TAG, tagId);
        const creationOrder = this.topologicalSort();
        const rootNode = this.nodes.get(tagId);
        return {
            rootId: tagId,
            rootName: rootNode?.name || 'Unknown',
            nodes: this.nodes,
            creationOrder
        };
    }
    /**
     * 여러 태그에서 시작하여 통합 그래프 구축
     */
    async buildFromTags(tagIds) {
        this.reset();
        for (const tagId of tagIds) {
            await this.bfsTraverse(gtm_1.EntityType.TAG, tagId);
        }
        const creationOrder = this.topologicalSort();
        return {
            rootId: tagIds[0] || '',
            rootName: 'Multiple Tags',
            nodes: this.nodes,
            creationOrder
        };
    }
    /**
     * 기존 엔티티 데이터로 그래프 구축 (API 호출 없이)
     * 선택된 태그에서 도달 가능한 엔티티만 포함
     *
     * @param tags - 선택된 태그들 (시작점)
     * @param triggers - 전체 트리거 목록
     * @param variables - 전체 변수 목록
     * @param options - 빌드 옵션 (역추적 설정 등)
     * @param templates - 전체 템플릿 목록 (선택)
     */
    buildFromEntities(tags, triggers, variables, options, templates) {
        this.reset();
        // 인덱스 맵 구축
        const triggerMap = new Map();
        const variableMap = new Map();
        const templateMap = new Map();
        const variableNameToId = new Map();
        const tagNameToId = new Map();
        const templateNameToId = new Map();
        const templateTypeToId = new Map(); // cvt_XXX -> templateId 매핑
        const tagMap = new Map();
        for (const trigger of triggers) {
            triggerMap.set(trigger.triggerId, trigger);
        }
        for (const variable of variables) {
            variableMap.set(variable.variableId, variable);
            variableNameToId.set(variable.name, variable.variableId);
            this.variableNameCache.set(variable.name, variable);
        }
        if (templates) {
            for (const template of templates) {
                templateMap.set(template.templateId, template);
                templateNameToId.set(template.name, template.templateId);
                // cvt_<containerId>_<templateId> 형태로 매핑 구축
                // GTM은 커스텀 템플릿의 public ID를 cvt_<containerId>_<templateId>로 생성
                if (template.containerId) {
                    templateTypeToId.set(`cvt_${template.containerId}_${template.templateId}`, template.templateId);
                }
                // Fallback: templateData에서 gallery 고유 cvt ID 추출
                if (template.templateData) {
                    const idMatch = template.templateData.match(/"id":\s*"(cvt_[^"]+)"/);
                    if (idMatch && idMatch[1] !== 'cvt_temp_public_id') {
                        templateTypeToId.set(idMatch[1], template.templateId);
                    }
                }
            }
        }
        // 전체 태그 맵 구축 (역추적용)
        const allTagsForReverse = options?.allWorkspaceTags || tags;
        for (const tag of allTagsForReverse) {
            tagMap.set(tag.tagId, tag);
            tagNameToId.set(tag.name, tag.tagId);
        }
        // 이벤트-태그 역방향 인덱스 구축 (역추적 활성화 시)
        const eventTagIndex = options?.enableReverseTracking
            ? this.buildEventTagIndex(allTagsForReverse)
            : {};
        // SetupTag/TeardownTag 역방향 인덱스 구축 (역추적 활성화 시)
        const tagSequenceIndex = options?.enableReverseTracking
            ? this.buildTagSequenceIndex(allTagsForReverse)
            : { setupTagUsers: new Map(), teardownTagUsers: new Map() };
        // BFS로 선택된 태그에서 도달 가능한 엔티티만 수집
        const reachableIds = new Set();
        const queue = [];
        // 시작점: 선택된 태그들
        for (const tag of tags) {
            queue.push({ type: gtm_1.EntityType.TAG, id: tag.tagId });
        }
        while (queue.length > 0) {
            const { type, id } = queue.shift();
            if (reachableIds.has(id))
                continue;
            reachableIds.add(id);
            let dependencies = [];
            if (type === gtm_1.EntityType.TAG) {
                const tag = tagMap.get(id) || tags.find(t => t.tagId === id);
                if (tag) {
                    dependencies = (0, parsers_1.extractTagDependencies)(tag);
                    // 역추적: 이 태그를 setupTag 또는 teardownTag으로 사용하는 다른 태그들 발견
                    // NOTE: 역추적은 BFS 발견(discovery)용으로만 사용. 의존성 엣지를 추가하지 않음.
                    // 생성 순서는 forward dependency (parsers.ts extractTagDependencies)가 결정.
                    // 잘못된 방향의 엣지를 추가하면 순환 의존성이 발생하여 topological sort가 깨짐.
                    if (options?.enableReverseTracking) {
                        const setupUsers = tagSequenceIndex.setupTagUsers.get(tag.name) || [];
                        const teardownUsers = tagSequenceIndex.teardownTagUsers.get(tag.name) || [];
                        for (const userTagId of setupUsers) {
                            if (!reachableIds.has(userTagId)) {
                                queue.push({ type: gtm_1.EntityType.TAG, id: userTagId });
                            }
                        }
                        for (const userTagId of teardownUsers) {
                            if (!reachableIds.has(userTagId)) {
                                queue.push({ type: gtm_1.EntityType.TAG, id: userTagId });
                            }
                        }
                    }
                    this.nodes.set(id, {
                        entityType: gtm_1.EntityType.TAG,
                        entityId: id,
                        name: tag.name,
                        data: tag,
                        dependencies
                    });
                }
            }
            else if (type === gtm_1.EntityType.TRIGGER) {
                const trigger = triggerMap.get(id);
                if (trigger) {
                    dependencies = (0, parsers_1.extractTriggerDependencies)(trigger);
                    // 역추적: CustomEvent 트리거가 감지하는 이벤트를 push하는 태그 발견
                    // NOTE: 역추적은 BFS 발견(discovery)용으로만 사용. 의존성 엣지를 추가하지 않음.
                    // 이벤트를 push하는 태그를 그래프에 포함시키되, 생성 순서에는 영향 없음.
                    if (options?.enableReverseTracking) {
                        const eventName = (0, parsers_1.extractCustomEventName)(trigger);
                        if (eventName) {
                            const pusherTagIds = eventTagIndex[eventName] || [];
                            for (const pusherTagId of pusherTagIds) {
                                if (!reachableIds.has(pusherTagId)) {
                                    const pusherTag = tagMap.get(pusherTagId);
                                    if (pusherTag) {
                                        queue.push({ type: gtm_1.EntityType.TAG, id: pusherTagId });
                                    }
                                }
                            }
                        }
                    }
                    this.nodes.set(id, {
                        entityType: gtm_1.EntityType.TRIGGER,
                        entityId: id,
                        name: trigger.name,
                        data: trigger,
                        dependencies
                    });
                }
            }
            else if (type === gtm_1.EntityType.VARIABLE) {
                const variable = variableMap.get(id);
                if (variable) {
                    // 허브 변수 타입 (gtes, gas)은 하위 의존성 추적 제외
                    // 이런 공유 설정 변수는 타겟에 이미 존재하거나 별도 관리됨
                    const isHubVariable = ['gtes', 'gas'].includes(variable.type);
                    dependencies = isHubVariable ? [] : (0, parsers_1.extractVariableDependencies)(variable);
                    this.nodes.set(id, {
                        entityType: gtm_1.EntityType.VARIABLE,
                        entityId: id,
                        name: variable.name,
                        data: variable,
                        variableType: variable.type,
                        dependencies,
                        isHubVariable
                    });
                }
            }
            else if (type === gtm_1.EntityType.TEMPLATE) {
                const template = templateMap.get(id);
                if (template) {
                    // Templates have no dependencies (they are leaf nodes)
                    dependencies = [];
                    this.nodes.set(id, {
                        entityType: gtm_1.EntityType.TEMPLATE,
                        entityId: id,
                        name: template.name,
                        data: template,
                        dependencies
                    });
                }
            }
            // 의존성을 큐에 추가
            for (const dep of dependencies) {
                let targetId = dep.targetId;
                // name:xxx 형태 → 실제 ID로 변환
                if (targetId && targetId.startsWith('name:')) {
                    const name = targetId.substring(5);
                    if (dep.targetType === gtm_1.EntityType.VARIABLE) {
                        targetId = variableNameToId.get(name) || targetId;
                    }
                    else if (dep.targetType === gtm_1.EntityType.TAG) {
                        targetId = tagNameToId.get(name) || targetId;
                    }
                    else if (dep.targetType === gtm_1.EntityType.TEMPLATE) {
                        targetId = templateNameToId.get(name) || targetId;
                    }
                    dep.targetId = targetId;
                }
                // cvt:xxx 형태 → 실제 템플릿 ID로 변환
                if (targetId && targetId.startsWith('cvt:')) {
                    const cvtType = targetId.substring(4); // "cvt:" prefix 제거
                    targetId = templateTypeToId.get(cvtType) || targetId;
                    dep.targetId = targetId;
                }
                if (targetId && !reachableIds.has(targetId) && !targetId.startsWith('name:') && !targetId.startsWith('cvt:')) {
                    queue.push({ type: dep.targetType, id: targetId });
                }
            }
        }
        const creationOrder = this.topologicalSort();
        return {
            rootId: tags[0]?.tagId || '',
            rootName: tags[0]?.name || 'Unknown',
            nodes: this.nodes,
            creationOrder
        };
    }
    /**
     * 이벤트-태그 역방향 인덱스 구축
     * 모든 태그에서 push하는 이벤트를 추출하여 인덱스 생성
     */
    buildEventTagIndex(tags) {
        const index = {};
        for (const tag of tags) {
            const events = (0, parsers_1.extractPushedEvents)(tag);
            for (const event of events) {
                if (!index[event]) {
                    index[event] = [];
                }
                index[event].push(tag.tagId);
            }
        }
        return index;
    }
    /**
     * SetupTag/TeardownTag 역방향 인덱스 구축
     * 모든 태그에서 setupTag/teardownTag으로 사용하는 태그 이름을 추출하여 인덱스 생성
     */
    buildTagSequenceIndex(tags) {
        const setupTagUsers = new Map();
        const teardownTagUsers = new Map();
        for (const tag of tags) {
            // setupTag 인덱스 구축
            if (tag.setupTag) {
                for (const setup of tag.setupTag) {
                    const targetName = setup.tagName;
                    if (targetName) {
                        if (!setupTagUsers.has(targetName)) {
                            setupTagUsers.set(targetName, []);
                        }
                        setupTagUsers.get(targetName).push(tag.tagId);
                    }
                }
            }
            // teardownTag 인덱스 구축
            if (tag.teardownTag) {
                for (const teardown of tag.teardownTag) {
                    const targetName = teardown.tagName;
                    if (targetName) {
                        if (!teardownTagUsers.has(targetName)) {
                            teardownTagUsers.set(targetName, []);
                        }
                        teardownTagUsers.get(targetName).push(tag.tagId);
                    }
                }
            }
        }
        return { setupTagUsers, teardownTagUsers };
    }
    /**
     * 분석 결과 생성 (Agent 반환용)
     */
    toAnalysisResult(graph) {
        const summary = this.createSummary();
        const creationOrder = graph.creationOrder.map((id, index) => {
            const node = graph.nodes.get(id);
            return {
                step: index + 1,
                type: node?.entityType || gtm_1.EntityType.VARIABLE,
                id,
                name: node?.name || 'Unknown'
            };
        });
        const nodes = {};
        for (const [id, node] of graph.nodes) {
            nodes[id] = {
                type: node.entityType,
                name: node.name,
                variableType: node.variableType,
                dependencies: node.dependencies.map(d => d.targetId),
                data: node.data
            };
        }
        return {
            summary,
            creationOrder,
            nodes
        };
    }
    // ==================== Private Methods ====================
    reset() {
        this.nodes.clear();
        this.visited.clear();
        this.variableNameCache.clear();
    }
    /**
     * BFS로 의존성 탐색
     */
    async bfsTraverse(entityType, entityId) {
        const queue = [
            { type: entityType, id: entityId }
        ];
        while (queue.length > 0) {
            const { type, id } = queue.shift();
            if (this.visited.has(id))
                continue;
            this.visited.add(id);
            const entity = await this.fetchEntity(type, id);
            if (!entity)
                continue;
            const dependencies = this.extractDependencies(type, entity);
            const node = {
                entityType: type,
                entityId: id,
                name: entity.name,
                data: entity,
                dependencies
            };
            if (type === gtm_1.EntityType.VARIABLE) {
                node.variableType = entity.type;
            }
            this.nodes.set(id, node);
            // 의존성을 큐에 추가
            for (const dep of dependencies) {
                if (!this.visited.has(dep.targetId)) {
                    queue.push({ type: dep.targetType, id: dep.targetId });
                }
            }
        }
    }
    /**
     * 엔티티 조회
     */
    async fetchEntity(type, id) {
        // null/undefined 체크
        if (!id) {
            return null;
        }
        // name:xxx 형태 → 이름으로 검색
        if (id.startsWith('name:')) {
            const name = id.substring(5);
            return this.findByName(type, name);
        }
        // ID로 직접 조회
        switch (type) {
            case gtm_1.EntityType.TAG:
                return this.adapter.getTag(id);
            case gtm_1.EntityType.TRIGGER:
                return this.adapter.getTrigger(id);
            case gtm_1.EntityType.VARIABLE:
                return this.adapter.getVariable(id);
            case gtm_1.EntityType.TEMPLATE:
                return this.adapter.getTemplate(id);
            default:
                return null;
        }
    }
    /**
     * 이름으로 엔티티 검색
     */
    async findByName(type, name) {
        switch (type) {
            case gtm_1.EntityType.VARIABLE:
                // 캐시 확인
                if (this.variableNameCache.has(name)) {
                    return this.variableNameCache.get(name) || null;
                }
                const variable = await this.adapter.findVariableByName(name);
                this.variableNameCache.set(name, variable);
                return variable;
            case gtm_1.EntityType.TAG:
                return this.adapter.findTagByName(name);
            default:
                return null;
        }
    }
    /**
     * 의존성 추출
     */
    extractDependencies(type, entity) {
        switch (type) {
            case gtm_1.EntityType.TAG:
                return (0, parsers_1.extractTagDependencies)(entity);
            case gtm_1.EntityType.TRIGGER:
                return (0, parsers_1.extractTriggerDependencies)(entity);
            case gtm_1.EntityType.VARIABLE:
                return (0, parsers_1.extractVariableDependencies)(entity);
            default:
                return [];
        }
    }
    /**
     * name: 참조를 실제 ID로 변환
     */
    resolveNameReferences(variables) {
        const nameToId = new Map();
        for (const v of variables) {
            nameToId.set(v.name, v.variableId);
        }
        for (const [, node] of this.nodes) {
            for (const dep of node.dependencies) {
                if (dep.targetId && dep.targetId.startsWith('name:') && dep.variableName) {
                    const realId = nameToId.get(dep.variableName);
                    if (realId) {
                        dep.targetId = realId;
                    }
                }
            }
        }
    }
    /**
     * Topological Sort (Kahn's Algorithm)
     * 개선: 누락된 노드 검증 및 복구
     */
    topologicalSort() {
        const inDegree = new Map();
        // 실제 ID로 변환된 dependency 맵 구축 (name:xxx, cvt:xxx 처리)
        const resolvedDeps = new Map();
        for (const [id, node] of this.nodes) {
            const deps = new Set();
            for (const dep of node.dependencies) {
                // 실제로 nodes에 존재하는 dependency만 추가
                if (this.nodes.has(dep.targetId)) {
                    deps.add(dep.targetId);
                }
            }
            resolvedDeps.set(id, deps);
        }
        for (const [id] of this.nodes) {
            inDegree.set(id, 0);
        }
        // In-degree 계산 (resolvedDeps 사용)
        for (const [nodeId, deps] of resolvedDeps) {
            inDegree.set(nodeId, deps.size);
        }
        // In-degree가 0인 노드부터 시작
        const queue = [];
        for (const [id, degree] of inDegree) {
            if (degree === 0) {
                queue.push(id);
            }
        }
        const result = [];
        const processed = new Set();
        while (queue.length > 0) {
            const current = queue.shift();
            result.push(current);
            processed.add(current);
            // current를 의존하는 노드들의 in-degree 감소
            for (const [id, deps] of resolvedDeps) {
                if (deps.has(current) && !processed.has(id)) {
                    const newDegree = (inDegree.get(id) || 0) - 1;
                    inDegree.set(id, newDegree);
                    if (newDegree === 0) {
                        queue.push(id);
                    }
                }
            }
        }
        // 누락된 노드 검증 및 복구
        if (result.length !== this.nodes.size) {
            console.warn(`[TopologicalSort] Incomplete: ${result.length}/${this.nodes.size} nodes processed`);
            // 누락된 노드 찾아서 추가 (순환 의존성 또는 미해결 참조)
            for (const [id, node] of this.nodes) {
                if (!processed.has(id)) {
                    console.warn(`[TopologicalSort] Adding missing node: ${node.entityType} "${node.name}" (${id})`);
                    result.push(id);
                }
            }
        }
        return this.sortByEntityType(result);
    }
    /**
     * 타입별 정렬 (Template → Variable → Trigger → Tag)
     */
    sortByEntityType(ids) {
        const typeOrder = {
            [gtm_1.EntityType.TEMPLATE]: 0,
            [gtm_1.EntityType.VARIABLE]: 1,
            [gtm_1.EntityType.TRIGGER]: 2,
            [gtm_1.EntityType.TAG]: 3,
            [gtm_1.EntityType.FOLDER]: 4
        };
        return ids.sort((a, b) => {
            const nodeA = this.nodes.get(a);
            const nodeB = this.nodes.get(b);
            if (!nodeA || !nodeB)
                return 0;
            return (typeOrder[nodeA.entityType] ?? 99) - (typeOrder[nodeB.entityType] ?? 99);
        });
    }
    /**
     * 요약 생성
     */
    createSummary() {
        let tags = 0;
        let triggers = 0;
        let variables = 0;
        let templates = 0;
        let jsVariablesWithInternalRefs = 0;
        for (const [, node] of this.nodes) {
            switch (node.entityType) {
                case gtm_1.EntityType.TAG:
                    tags++;
                    break;
                case gtm_1.EntityType.TRIGGER:
                    triggers++;
                    break;
                case gtm_1.EntityType.VARIABLE:
                    variables++;
                    if (node.variableType === 'jsm') {
                        const hasInternalRefs = node.dependencies.some(d => d.dependencyType === dependency_1.DependencyType.JS_INTERNAL_REF);
                        if (hasInternalRefs) {
                            jsVariablesWithInternalRefs++;
                        }
                    }
                    break;
                case gtm_1.EntityType.TEMPLATE:
                    templates++;
                    break;
            }
        }
        return {
            total: this.nodes.size,
            tags,
            triggers,
            variables,
            templates,
            jsVariablesWithInternalRefs
        };
    }
}
exports.DependencyGraphBuilder = DependencyGraphBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9kZXBlbmRlbmN5LXJlc29sdmVyL2dyYXBoLWJ1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsc0NBT3NCO0FBQ3RCLG9EQVM2QjtBQUM3Qix1Q0FNbUI7QUE0RG5CLDBEQUEwRDtBQUUxRCxNQUFhLHNCQUFzQjtJQU1qQyxZQUFZLE9BQXNCO1FBSjFCLFVBQUssR0FBZ0MsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUMvQyxZQUFPLEdBQWdCLElBQUksR0FBRyxFQUFFLENBQUM7UUFDakMsc0JBQWlCLEdBQW9DLElBQUksR0FBRyxFQUFFLENBQUM7UUFHckUsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDekIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFlBQVksQ0FBQyxLQUFhO1FBQzlCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNiLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBVSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM5QyxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFN0MsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFdkMsT0FBTztZQUNMLE1BQU0sRUFBRSxLQUFLO1lBQ2IsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLElBQUksU0FBUztZQUNyQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7WUFDakIsYUFBYTtTQUNkLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQWdCO1FBQ2xDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUViLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFLENBQUM7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RUFBRSxDQUFDO1lBQ2xDLFFBQVEsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUN4QixLQUFLLGdCQUFVLENBQUMsR0FBRztvQkFDakIsSUFBSSxFQUFFLENBQUM7b0JBQ1AsTUFBTTtnQkFDUixLQUFLLGdCQUFVLENBQUMsT0FBTztvQkFDckIsUUFBUSxFQUFFLENBQUM7b0JBQ1gsTUFBTTtnQkFDUixLQUFLLGdCQUFVLENBQUMsUUFBUTtvQkFDdEIsU0FBUyxFQUFFLENBQUM7b0JBQ1osSUFBSSxJQUFJLENBQUMsWUFBWSxLQUFLLEtBQUssRUFBRSxDQUFDO3dCQUNoQyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FDNUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLDJCQUFjLENBQUMsZUFBZSxDQUN6RCxDQUFDO3dCQUNGLElBQUksZUFBZSxFQUFFLENBQUM7NEJBQ3BCLDJCQUEyQixFQUFFLENBQUM7d0JBQ2hDLENBQUM7b0JBQ0gsQ0FBQztvQkFDRCxNQUFNO2dCQUNSLEtBQUssZ0JBQVUsQ0FBQyxRQUFRO29CQUN0QixTQUFTLEVBQUUsQ0FBQztvQkFDWixNQUFNO1lBQ1YsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPO1lBQ0wsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSTtZQUN0QixJQUFJO1lBQ0osUUFBUTtZQUNSLFNBQVM7WUFDVCxTQUFTO1lBQ1QsMkJBQTJCO1NBQzVCLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF2cEJELHdEQXVwQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogRGVwZW5kZW5jeSBHcmFwaCBCdWlsZGVyXHJcbiAqXHJcbiAqIEdUTSBNQ1Drpbwg7Ya17ZW0IOyXlO2LsO2LsOulvCDsobDtmoztlZjqs6Ag7J2Y7KG07ISxIOq3uOuemO2UhOulvCDqtazstpXtlanri4jri6QuXHJcbiAqIC0gQkZT66GcIOyghOyytCDsnZjsobTshLEg7YOQ7IOJXHJcbiAqIC0gVG9wb2xvZ2ljYWwgU29ydOuhnCDsg53shLEg7Iic7IScIOqysOyglVxyXG4gKi9cclxuXHJcbmltcG9ydCB7XHJcbiAgRW50aXR5VHlwZSxcclxuICBHVE1UYWcsXHJcbiAgR1RNVHJpZ2dlcixcclxuICBHVE1WYXJpYWJsZSxcclxuICBHVE1UZW1wbGF0ZSxcclxuICBHVE1FbnRpdHlcclxufSBmcm9tICcuLi90eXBlcy9ndG0nO1xyXG5pbXBvcnQge1xyXG4gIERlcGVuZGVuY3lOb2RlLFxyXG4gIERlcGVuZGVuY3lFZGdlLFxyXG4gIERlcGVuZGVuY3lHcmFwaCxcclxuICBBbmFseXNpc1N1bW1hcnksXHJcbiAgQW5hbHlzaXNSZXN1bHQsXHJcbiAgQ3JlYXRpb25PcmRlckl0ZW0sXHJcbiAgTm9kZUluZm8sXHJcbiAgRGVwZW5kZW5jeVR5cGVcclxufSBmcm9tICcuLi90eXBlcy9kZXBlbmRlbmN5JztcclxuaW1wb3J0IHtcclxuICBleHRyYWN0VGFnRGVwZW5kZW5jaWVzLFxyXG4gIGV4dHJhY3RUcmlnZ2VyRGVwZW5kZW5jaWVzLFxyXG4gIGV4dHJhY3RWYXJpYWJsZURlcGVuZGVuY2llcyxcclxuICBleHRyYWN0Q3VzdG9tRXZlbnROYW1lLFxyXG4gIGV4dHJhY3RQdXNoZWRFdmVudHNcclxufSBmcm9tICcuL3BhcnNlcnMnO1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT0gTUNQIEFkYXB0ZXIgSW50ZXJmYWNlID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogR1RNIE1DUCDtmLjstpzsnYQg7JyE7ZWcIOyWtOuMke2EsCDsnbjthLDtjpjsnbTsiqRcclxuICogQWdlbnTqsIAg7Iuk7KCcIE1DUCDtmLjstpzsnYQg7KO87J6F7ZWp64uI64ukLlxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBHVE1NQ1BBZGFwdGVyIHtcclxuICBnZXRUYWcodGFnSWQ6IHN0cmluZyk6IFByb21pc2U8R1RNVGFnIHwgbnVsbD47XHJcbiAgZ2V0VHJpZ2dlcih0cmlnZ2VySWQ6IHN0cmluZyk6IFByb21pc2U8R1RNVHJpZ2dlciB8IG51bGw+O1xyXG4gIGdldFZhcmlhYmxlKHZhcmlhYmxlSWQ6IHN0cmluZyk6IFByb21pc2U8R1RNVmFyaWFibGUgfCBudWxsPjtcclxuICBnZXRUZW1wbGF0ZSh0ZW1wbGF0ZUlkOiBzdHJpbmcpOiBQcm9taXNlPEdUTVRlbXBsYXRlIHwgbnVsbD47XHJcbiAgZmluZFZhcmlhYmxlQnlOYW1lKG5hbWU6IHN0cmluZyk6IFByb21pc2U8R1RNVmFyaWFibGUgfCBudWxsPjtcclxuICBmaW5kVGFnQnlOYW1lKG5hbWU6IHN0cmluZyk6IFByb21pc2U8R1RNVGFnIHwgbnVsbD47XHJcbiAgZmluZFRlbXBsYXRlQnlOYW1lPyhuYW1lOiBzdHJpbmcpOiBQcm9taXNlPEdUTVRlbXBsYXRlIHwgbnVsbD47XHJcbiAgbGlzdFRhZ3MoKTogUHJvbWlzZTxHVE1UYWdbXT47XHJcbiAgbGlzdFRyaWdnZXJzKCk6IFByb21pc2U8R1RNVHJpZ2dlcltdPjtcclxuICBsaXN0VmFyaWFibGVzKCk6IFByb21pc2U8R1RNVmFyaWFibGVbXT47XHJcbiAgbGlzdFRlbXBsYXRlcygpOiBQcm9taXNlPEdUTVRlbXBsYXRlW10+O1xyXG4gIGNyZWF0ZVRlbXBsYXRlPyhjb25maWc6IFBhcnRpYWw8R1RNVGVtcGxhdGU+KTogUHJvbWlzZTxHVE1UZW1wbGF0ZT47XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09IEJ1aWxkIE9wdGlvbnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiDsnbTrsqTtirgt7YOc6re4IOyXreuwqe2WpSDsnbjrjbHsiqRcclxuICogZXZlbnROYW1lIOKGkiDtlbTri7kg7J2067Kk7Yq466W8IHB1c2jtlZjripQg7YOc6re4IElEIOuqqeuhnVxyXG4gKi9cclxuaW50ZXJmYWNlIEV2ZW50VGFnSW5kZXgge1xyXG4gIFtldmVudE5hbWU6IHN0cmluZ106IHN0cmluZ1tdO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0dXBUYWcvVGVhcmRvd25UYWcg7Jet67Cp7ZalIOyduOuNseyKpFxyXG4gKiB0YWdOYW1lIOKGkiDtlbTri7kg7YOc6re466W8IHNldHVwVGFnIOuYkOuKlCB0ZWFyZG93blRhZ+ycvOuhnCDsgqzsmqntlZjripQg7YOc6re4IElEIOuqqeuhnVxyXG4gKi9cclxuaW50ZXJmYWNlIFRhZ1NlcXVlbmNlSW5kZXgge1xyXG4gIHNldHVwVGFnVXNlcnM6IE1hcDxzdHJpbmcsIHN0cmluZ1tdPjsgICAgLy8gdGFnTmFtZSDihpIg7J20IO2DnOq3uOulvCBzZXR1cFRhZ+ycvOuhnCDsgqzsmqntlZjripQg7YOc6re465OkXHJcbiAgdGVhcmRvd25UYWdVc2VyczogTWFwPHN0cmluZywgc3RyaW5nW10+OyAvLyB0YWdOYW1lIOKGkiDsnbQg7YOc6re466W8IHRlYXJkb3duVGFn7Jy866GcIOyCrOyaqe2VmOuKlCDtg5zqt7jrk6RcclxufVxyXG5cclxuLyoqXHJcbiAqIOq3uOuemO2UhCDruYzrk5wg7Ji17IWYXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWxkT3B0aW9ucyB7XHJcbiAgLyoqXHJcbiAgICog7Jet7LaU7KCBIO2ZnOyEse2ZlCDsl6zrtoBcclxuICAgKiB0cnVlOiBDdXN0b21FdmVudCDtirjrpqzqsbDqsIAg6rCQ7KeA7ZWY64qUIOydtOuypO2KuOulvCBwdXNo7ZWY64qUIO2DnOq3uOuPhCDstpTsoIFcclxuICAgKiB0cnVlOiBzZXR1cFRhZy90ZWFyZG93blRhZ+ycvOuhnCDshKDtg53rkJwg7YOc6re466W8IOyCrOyaqe2VmOuKlCDtg5zqt7jrj4Qg7LaU7KCBXHJcbiAgICovXHJcbiAgZW5hYmxlUmV2ZXJzZVRyYWNraW5nPzogYm9vbGVhbjtcclxuXHJcbiAgLyoqXHJcbiAgICog7Jet7LaU7KCB7JqpIOyghOyytCDsm4ztgazsiqTtjpjsnbTsiqQg7YOc6re4XHJcbiAgICog7ISg7YOd65CcIO2DnOq3uOyZgCDrs4Trj4TroZwsIOyXrey2lOyggSDsi5wg6rKA7IOJIOuMgOyDgeydtCDrkJjripQg66qo65OgIO2DnOq3uFxyXG4gICAqL1xyXG4gIGFsbFdvcmtzcGFjZVRhZ3M/OiBHVE1UYWdbXTtcclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT0gR3JhcGggQnVpbGRlciA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuZXhwb3J0IGNsYXNzIERlcGVuZGVuY3lHcmFwaEJ1aWxkZXIge1xyXG4gIHByaXZhdGUgYWRhcHRlcjogR1RNTUNQQWRhcHRlcjtcclxuICBwcml2YXRlIG5vZGVzOiBNYXA8c3RyaW5nLCBEZXBlbmRlbmN5Tm9kZT4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSB2aXNpdGVkOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcclxuICBwcml2YXRlIHZhcmlhYmxlTmFtZUNhY2hlOiBNYXA8c3RyaW5nLCBHVE1WYXJpYWJsZSB8IG51bGw+ID0gbmV3IE1hcCgpO1xyXG5cclxuICBjb25zdHJ1Y3RvcihhZGFwdGVyOiBHVE1NQ1BBZGFwdGVyKSB7XHJcbiAgICB0aGlzLmFkYXB0ZXIgPSBhZGFwdGVyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7YOc6re47JeQ7IScIOyLnOyeke2VmOyXrCDsoITssrQg7J2Y7KG07ISxIOq3uOuemO2UhCDqtazstpVcclxuICAgKi9cclxuICBhc3luYyBidWlsZEZyb21UYWcodGFnSWQ6IHN0cmluZyk6IFByb21pc2U8RGVwZW5kZW5jeUdyYXBoPiB7XHJcbiAgICB0aGlzLnJlc2V0KCk7XHJcbiAgICBhd2FpdCB0aGlzLmJmc1RyYXZlcnNlKEVudGl0eVR5cGUuVEFHLCB0YWdJZCk7XHJcbiAgICBjb25zdCBjcmVhdGlvbk9yZGVyID0gdGhpcy50b3BvbG9naWNhbFNvcnQoKTtcclxuXHJcbiAgICBjb25zdCByb290Tm9kZSA9IHRoaXMubm9kZXMuZ2V0KHRhZ0lkKTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICByb290SWQ6IHRhZ0lkLFxyXG4gICAgICByb290TmFtZTogcm9vdE5vZGU/Lm5hbWUgfHwgJ1Vua25vd24nLFxyXG4gICAgICBub2RlczogdGhpcy5ub2RlcyxcclxuICAgICAgY3JlYXRpb25PcmRlclxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOyXrOufrCDtg5zqt7jsl5DshJwg7Iuc7J6R7ZWY7JesIO2Gte2VqSDqt7jrnpjtlIQg6rWs7LaVXHJcbiAgICovXHJcbiAgYXN5bmMgYnVpbGRGcm9tVGFncyh0YWdJZHM6IHN0cmluZ1tdKTogUHJvbWlzZTxEZXBlbmRlbmN5R3JhcGg+IHtcclxuICAgIHRoaXMucmVzZXQoKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHRhZ0lkIG9mIHRhZ0lkcykge1xyXG4gICAgICBhd2FpdCB0aGlzLmJmc1RyYXZlcnNlKEVudGl0eVR5cGUuVEFHLCB0YWdJZCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY3JlYXRpb25PcmRlciA9IHRoaXMudG9wb2xvZ2ljYWxTb3J0KCk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcm9vdElkOiB0YWdJZHNbMF0gfHwgJycsXHJcbiAgICAgIHJvb3ROYW1lOiAnTXVsdGlwbGUgVGFncycsXHJcbiAgICAgIG5vZGVzOiB0aGlzLm5vZGVzLFxyXG4gICAgICBjcmVhdGlvbk9yZGVyXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog6riw7KG0IOyXlO2LsO2LsCDrjbDsnbTthLDroZwg6re4656Y7ZSEIOq1rOy2lSAoQVBJIO2YuOy2nCDsl4bsnbQpXHJcbiAgICog7ISg7YOd65CcIO2DnOq3uOyXkOyEnCDrj4Tri6wg6rCA64ql7ZWcIOyXlO2LsO2LsOunjCDtj6ztlahcclxuICAgKlxyXG4gICAqIEBwYXJhbSB0YWdzIC0g7ISg7YOd65CcIO2DnOq3uOuTpCAo7Iuc7J6R7KCQKVxyXG4gICAqIEBwYXJhbSB0cmlnZ2VycyAtIOyghOyytCDtirjrpqzqsbAg66qp66GdXHJcbiAgICogQHBhcmFtIHZhcmlhYmxlcyAtIOyghOyytCDrs4DsiJgg66qp66GdXHJcbiAgICogQHBhcmFtIG9wdGlvbnMgLSDruYzrk5wg7Ji17IWYICjsl63stpTsoIEg7ISk7KCVIOuTsSlcclxuICAgKiBAcGFyYW0gdGVtcGxhdGVzIC0g7KCE7LK0IO2FnO2UjOumvyDrqqnroZ0gKOyEoO2DnSlcclxuICAgKi9cclxuICBidWlsZEZyb21FbnRpdGllcyhcclxuICAgIHRhZ3M6IEdUTVRhZ1tdLFxyXG4gICAgdHJpZ2dlcnM6IEdUTVRyaWdnZXJbXSxcclxuICAgIHZhcmlhYmxlczogR1RNVmFyaWFibGVbXSxcclxuICAgIG9wdGlvbnM/OiBCdWlsZE9wdGlvbnMsXHJcbiAgICB0ZW1wbGF0ZXM/OiBHVE1UZW1wbGF0ZVtdXHJcbiAgKTogRGVwZW5kZW5jeUdyYXBoIHtcclxuICAgIHRoaXMucmVzZXQoKTtcclxuXHJcbiAgICAvLyDsnbjrjbHsiqQg66e1IOq1rOy2lVxyXG4gICAgY29uc3QgdHJpZ2dlck1hcCA9IG5ldyBNYXA8c3RyaW5nLCBHVE1UcmlnZ2VyPigpO1xyXG4gICAgY29uc3QgdmFyaWFibGVNYXAgPSBuZXcgTWFwPHN0cmluZywgR1RNVmFyaWFibGU+KCk7XHJcbiAgICBjb25zdCB0ZW1wbGF0ZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBHVE1UZW1wbGF0ZT4oKTtcclxuICAgIGNvbnN0IHZhcmlhYmxlTmFtZVRvSWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xyXG4gICAgY29uc3QgdGFnTmFtZVRvSWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xyXG4gICAgY29uc3QgdGVtcGxhdGVOYW1lVG9JZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XHJcbiAgICBjb25zdCB0ZW1wbGF0ZVR5cGVUb0lkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTsgIC8vIGN2dF9YWFggLT4gdGVtcGxhdGVJZCDrp6TtlZFcclxuICAgIGNvbnN0IHRhZ01hcCA9IG5ldyBNYXA8c3RyaW5nLCBHVE1UYWc+KCk7XHJcblxyXG4gICAgZm9yIChjb25zdCB0cmlnZ2VyIG9mIHRyaWdnZXJzKSB7XHJcbiAgICAgIHRyaWdnZXJNYXAuc2V0KHRyaWdnZXIudHJpZ2dlcklkLCB0cmlnZ2VyKTtcclxuICAgIH1cclxuICAgIGZvciAoY29uc3QgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XHJcbiAgICAgIHZhcmlhYmxlTWFwLnNldCh2YXJpYWJsZS52YXJpYWJsZUlkLCB2YXJpYWJsZSk7XHJcbiAgICAgIHZhcmlhYmxlTmFtZVRvSWQuc2V0KHZhcmlhYmxlLm5hbWUsIHZhcmlhYmxlLnZhcmlhYmxlSWQpO1xyXG4gICAgICB0aGlzLnZhcmlhYmxlTmFtZUNhY2hlLnNldCh2YXJpYWJsZS5uYW1lLCB2YXJpYWJsZSk7XHJcbiAgICB9XHJcbiAgICBpZiAodGVtcGxhdGVzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgdGVtcGxhdGUgb2YgdGVtcGxhdGVzKSB7XHJcbiAgICAgICAgdGVtcGxhdGVNYXAuc2V0KHRlbXBsYXRlLnRlbXBsYXRlSWQsIHRlbXBsYXRlKTtcclxuICAgICAgICB0ZW1wbGF0ZU5hbWVUb0lkLnNldCh0ZW1wbGF0ZS5uYW1lLCB0ZW1wbGF0ZS50ZW1wbGF0ZUlkKTtcclxuXHJcbiAgICAgICAgLy8gY3Z0Xzxjb250YWluZXJJZD5fPHRlbXBsYXRlSWQ+IO2Yle2DnOuhnCDrp6TtlZEg6rWs7LaVXHJcbiAgICAgICAgLy8gR1RN7J2AIOy7pOyKpO2FgCDthZztlIzrpr/snZggcHVibGljIElE66W8IGN2dF88Y29udGFpbmVySWQ+Xzx0ZW1wbGF0ZUlkPuuhnCDsg53shLFcclxuICAgICAgICBpZiAodGVtcGxhdGUuY29udGFpbmVySWQpIHtcclxuICAgICAgICAgIHRlbXBsYXRlVHlwZVRvSWQuc2V0KGBjdnRfJHt0ZW1wbGF0ZS5jb250YWluZXJJZH1fJHt0ZW1wbGF0ZS50ZW1wbGF0ZUlkfWAsIHRlbXBsYXRlLnRlbXBsYXRlSWQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gRmFsbGJhY2s6IHRlbXBsYXRlRGF0YeyXkOyEnCBnYWxsZXJ5IOqzoOycoCBjdnQgSUQg7LaU7LacXHJcbiAgICAgICAgaWYgKHRlbXBsYXRlLnRlbXBsYXRlRGF0YSkge1xyXG4gICAgICAgICAgY29uc3QgaWRNYXRjaCA9IHRlbXBsYXRlLnRlbXBsYXRlRGF0YS5tYXRjaCgvXCJpZFwiOlxccypcIihjdnRfW15cIl0rKVwiLyk7XHJcbiAgICAgICAgICBpZiAoaWRNYXRjaCAmJiBpZE1hdGNoWzFdICE9PSAnY3Z0X3RlbXBfcHVibGljX2lkJykge1xyXG4gICAgICAgICAgICB0ZW1wbGF0ZVR5cGVUb0lkLnNldChpZE1hdGNoWzFdLCB0ZW1wbGF0ZS50ZW1wbGF0ZUlkKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyDsoITssrQg7YOc6re4IOuntSDqtazstpUgKOyXrey2lOyggeyaqSlcclxuICAgIGNvbnN0IGFsbFRhZ3NGb3JSZXZlcnNlID0gb3B0aW9ucz8uYWxsV29ya3NwYWNlVGFncyB8fCB0YWdzO1xyXG4gICAgZm9yIChjb25zdCB0YWcgb2YgYWxsVGFnc0ZvclJldmVyc2UpIHtcclxuICAgICAgdGFnTWFwLnNldCh0YWcudGFnSWQsIHRhZyk7XHJcbiAgICAgIHRhZ05hbWVUb0lkLnNldCh0YWcubmFtZSwgdGFnLnRhZ0lkKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyDsnbTrsqTtirgt7YOc6re4IOyXreuwqe2WpSDsnbjrjbHsiqQg6rWs7LaVICjsl63stpTsoIEg7Zmc7ISx7ZmUIOyLnClcclxuICAgIGNvbnN0IGV2ZW50VGFnSW5kZXg6IEV2ZW50VGFnSW5kZXggPSBvcHRpb25zPy5lbmFibGVSZXZlcnNlVHJhY2tpbmdcclxuICAgICAgPyB0aGlzLmJ1aWxkRXZlbnRUYWdJbmRleChhbGxUYWdzRm9yUmV2ZXJzZSlcclxuICAgICAgOiB7fTtcclxuXHJcbiAgICAvLyBTZXR1cFRhZy9UZWFyZG93blRhZyDsl63rsKntlqUg7J24642x7IqkIOq1rOy2lSAo7Jet7LaU7KCBIO2ZnOyEse2ZlCDsi5wpXHJcbiAgICBjb25zdCB0YWdTZXF1ZW5jZUluZGV4OiBUYWdTZXF1ZW5jZUluZGV4ID0gb3B0aW9ucz8uZW5hYmxlUmV2ZXJzZVRyYWNraW5nXHJcbiAgICAgID8gdGhpcy5idWlsZFRhZ1NlcXVlbmNlSW5kZXgoYWxsVGFnc0ZvclJldmVyc2UpXHJcbiAgICAgIDogeyBzZXR1cFRhZ1VzZXJzOiBuZXcgTWFwKCksIHRlYXJkb3duVGFnVXNlcnM6IG5ldyBNYXAoKSB9O1xyXG5cclxuICAgIC8vIEJGU+uhnCDshKDtg53rkJwg7YOc6re47JeQ7IScIOuPhOuLrCDqsIDriqXtlZwg7JeU7Yuw7Yuw66eMIOyImOynkVxyXG4gICAgY29uc3QgcmVhY2hhYmxlSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgICBjb25zdCBxdWV1ZTogQXJyYXk8eyB0eXBlOiBFbnRpdHlUeXBlOyBpZDogc3RyaW5nIH0+ID0gW107XHJcblxyXG4gICAgLy8g7Iuc7J6R7KCQOiDshKDtg53rkJwg7YOc6re465OkXHJcbiAgICBmb3IgKGNvbnN0IHRhZyBvZiB0YWdzKSB7XHJcbiAgICAgIHF1ZXVlLnB1c2goeyB0eXBlOiBFbnRpdHlUeXBlLlRBRywgaWQ6IHRhZy50YWdJZCB9KTtcclxuICAgIH1cclxuXHJcbiAgICB3aGlsZSAocXVldWUubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCB7IHR5cGUsIGlkIH0gPSBxdWV1ZS5zaGlmdCgpITtcclxuXHJcbiAgICAgIGlmIChyZWFjaGFibGVJZHMuaGFzKGlkKSkgY29udGludWU7XHJcbiAgICAgIHJlYWNoYWJsZUlkcy5hZGQoaWQpO1xyXG5cclxuICAgICAgbGV0IGRlcGVuZGVuY2llczogRGVwZW5kZW5jeUVkZ2VbXSA9IFtdO1xyXG5cclxuICAgICAgaWYgKHR5cGUgPT09IEVudGl0eVR5cGUuVEFHKSB7XHJcbiAgICAgICAgY29uc3QgdGFnID0gdGFnTWFwLmdldChpZCkgfHwgdGFncy5maW5kKHQgPT4gdC50YWdJZCA9PT0gaWQpO1xyXG4gICAgICAgIGlmICh0YWcpIHtcclxuICAgICAgICAgIGRlcGVuZGVuY2llcyA9IGV4dHJhY3RUYWdEZXBlbmRlbmNpZXModGFnKTtcclxuXHJcbiAgICAgICAgICAvLyDsl63stpTsoIE6IOydtCDtg5zqt7jrpbwgc2V0dXBUYWcg65iQ64qUIHRlYXJkb3duVGFn7Jy866GcIOyCrOyaqe2VmOuKlCDri6Trpbgg7YOc6re465OkIOuwnOqyrFxyXG4gICAgICAgICAgLy8gTk9URTog7Jet7LaU7KCB7J2AIEJGUyDrsJzqsqwoZGlzY292ZXJ5KeyaqeycvOuhnOunjCDsgqzsmqkuIOydmOyhtOyEsSDsl6Psp4Drpbwg7LaU6rCA7ZWY7KeAIOyViuydjC5cclxuICAgICAgICAgIC8vIOyDneyEsSDsiJzshJzripQgZm9yd2FyZCBkZXBlbmRlbmN5IChwYXJzZXJzLnRzIGV4dHJhY3RUYWdEZXBlbmRlbmNpZXMp6rCAIOqysOyglS5cclxuICAgICAgICAgIC8vIOyemOuqu+uQnCDrsKntlqXsnZgg7Jej7KeA66W8IOy2lOqwgO2VmOuptCDsiJztmZgg7J2Y7KG07ISx7J20IOuwnOyDne2VmOyXrCB0b3BvbG9naWNhbCBzb3J06rCAIOq5qOynkC5cclxuICAgICAgICAgIGlmIChvcHRpb25zPy5lbmFibGVSZXZlcnNlVHJhY2tpbmcpIHtcclxuICAgICAgICAgICAgY29uc3Qgc2V0dXBVc2VycyA9IHRhZ1NlcXVlbmNlSW5kZXguc2V0dXBUYWdVc2Vycy5nZXQodGFnLm5hbWUpIHx8IFtdO1xyXG4gICAgICAgICAgICBjb25zdCB0ZWFyZG93blVzZXJzID0gdGFnU2VxdWVuY2VJbmRleC50ZWFyZG93blRhZ1VzZXJzLmdldCh0YWcubmFtZSkgfHwgW107XHJcblxyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHVzZXJUYWdJZCBvZiBzZXR1cFVzZXJzKSB7XHJcbiAgICAgICAgICAgICAgaWYgKCFyZWFjaGFibGVJZHMuaGFzKHVzZXJUYWdJZCkpIHtcclxuICAgICAgICAgICAgICAgIHF1ZXVlLnB1c2goeyB0eXBlOiBFbnRpdHlUeXBlLlRBRywgaWQ6IHVzZXJUYWdJZCB9KTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgdXNlclRhZ0lkIG9mIHRlYXJkb3duVXNlcnMpIHtcclxuICAgICAgICAgICAgICBpZiAoIXJlYWNoYWJsZUlkcy5oYXModXNlclRhZ0lkKSkge1xyXG4gICAgICAgICAgICAgICAgcXVldWUucHVzaCh7IHR5cGU6IEVudGl0eVR5cGUuVEFHLCBpZDogdXNlclRhZ0lkIH0pO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHRoaXMubm9kZXMuc2V0KGlkLCB7XHJcbiAgICAgICAgICAgIGVudGl0eVR5cGU6IEVudGl0eVR5cGUuVEFHLFxyXG4gICAgICAgICAgICBlbnRpdHlJZDogaWQsXHJcbiAgICAgICAgICAgIG5hbWU6IHRhZy5uYW1lLFxyXG4gICAgICAgICAgICBkYXRhOiB0YWcsXHJcbiAgICAgICAgICAgIGRlcGVuZGVuY2llc1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IEVudGl0eVR5cGUuVFJJR0dFUikge1xyXG4gICAgICAgIGNvbnN0IHRyaWdnZXIgPSB0cmlnZ2VyTWFwLmdldChpZCk7XHJcbiAgICAgICAgaWYgKHRyaWdnZXIpIHtcclxuICAgICAgICAgIGRlcGVuZGVuY2llcyA9IGV4dHJhY3RUcmlnZ2VyRGVwZW5kZW5jaWVzKHRyaWdnZXIpO1xyXG5cclxuICAgICAgICAgIC8vIOyXrey2lOyggTogQ3VzdG9tRXZlbnQg7Yq466as6rGw6rCAIOqwkOyngO2VmOuKlCDsnbTrsqTtirjrpbwgcHVzaO2VmOuKlCDtg5zqt7gg67Cc6rKsXHJcbiAgICAgICAgICAvLyBOT1RFOiDsl63stpTsoIHsnYAgQkZTIOuwnOqyrChkaXNjb3Zlcnkp7Jqp7Jy866Gc66eMIOyCrOyaqS4g7J2Y7KG07ISxIOyXo+yngOulvCDstpTqsIDtlZjsp4Ag7JWK7J2MLlxyXG4gICAgICAgICAgLy8g7J2067Kk7Yq466W8IHB1c2jtlZjripQg7YOc6re466W8IOq3uOuemO2UhOyXkCDtj6ztlajsi5ztgqTrkJgsIOyDneyEsSDsiJzshJzsl5DripQg7JiB7ZalIOyXhuydjC5cclxuICAgICAgICAgIGlmIChvcHRpb25zPy5lbmFibGVSZXZlcnNlVHJhY2tpbmcpIHtcclxuICAgICAgICAgICAgY29uc3QgZXZlbnROYW1lID0gZXh0cmFjdEN1c3RvbUV2ZW50TmFtZSh0cmlnZ2VyKTtcclxuICAgICAgICAgICAgaWYgKGV2ZW50TmFtZSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHB1c2hlclRhZ0lkcyA9IGV2ZW50VGFnSW5kZXhbZXZlbnROYW1lXSB8fCBbXTtcclxuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHB1c2hlclRhZ0lkIG9mIHB1c2hlclRhZ0lkcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyZWFjaGFibGVJZHMuaGFzKHB1c2hlclRhZ0lkKSkge1xyXG4gICAgICAgICAgICAgICAgICBjb25zdCBwdXNoZXJUYWcgPSB0YWdNYXAuZ2V0KHB1c2hlclRhZ0lkKTtcclxuICAgICAgICAgICAgICAgICAgaWYgKHB1c2hlclRhZykge1xyXG4gICAgICAgICAgICAgICAgICAgIHF1ZXVlLnB1c2goeyB0eXBlOiBFbnRpdHlUeXBlLlRBRywgaWQ6IHB1c2hlclRhZ0lkIH0pO1xyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgdGhpcy5ub2Rlcy5zZXQoaWQsIHtcclxuICAgICAgICAgICAgZW50aXR5VHlwZTogRW50aXR5VHlwZS5UUklHR0VSLFxyXG4gICAgICAgICAgICBlbnRpdHlJZDogaWQsXHJcbiAgICAgICAgICAgIG5hbWU6IHRyaWdnZXIubmFtZSxcclxuICAgICAgICAgICAgZGF0YTogdHJpZ2dlcixcclxuICAgICAgICAgICAgZGVwZW5kZW5jaWVzXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gRW50aXR5VHlwZS5WQVJJQUJMRSkge1xyXG4gICAgICAgIGNvbnN0IHZhcmlhYmxlID0gdmFyaWFibGVNYXAuZ2V0KGlkKTtcclxuICAgICAgICBpZiAodmFyaWFibGUpIHtcclxuICAgICAgICAgIC8vIO2XiOu4jCDrs4DsiJgg7YOA7J6FIChndGVzLCBnYXMp7J2AIO2VmOychCDsnZjsobTshLEg7LaU7KCBIOygnOyZuFxyXG4gICAgICAgICAgLy8g7J2065+wIOqzteycoCDshKTsoJUg67OA7IiY64qUIO2DgOqyn+yXkCDsnbTrr7gg7KG07J6s7ZWY6rGw64KYIOuzhOuPhCDqtIDrpqzrkKhcclxuICAgICAgICAgIGNvbnN0IGlzSHViVmFyaWFibGUgPSBbJ2d0ZXMnLCAnZ2FzJ10uaW5jbHVkZXModmFyaWFibGUudHlwZSk7XHJcbiAgICAgICAgICBkZXBlbmRlbmNpZXMgPSBpc0h1YlZhcmlhYmxlID8gW10gOiBleHRyYWN0VmFyaWFibGVEZXBlbmRlbmNpZXModmFyaWFibGUpO1xyXG5cclxuICAgICAgICAgIHRoaXMubm9kZXMuc2V0KGlkLCB7XHJcbiAgICAgICAgICAgIGVudGl0eVR5cGU6IEVudGl0eVR5cGUuVkFSSUFCTEUsXHJcbiAgICAgICAgICAgIGVudGl0eUlkOiBpZCxcclxuICAgICAgICAgICAgbmFtZTogdmFyaWFibGUubmFtZSxcclxuICAgICAgICAgICAgZGF0YTogdmFyaWFibGUsXHJcbiAgICAgICAgICAgIHZhcmlhYmxlVHlwZTogdmFyaWFibGUudHlwZSxcclxuICAgICAgICAgICAgZGVwZW5kZW5jaWVzLFxyXG4gICAgICAgICAgICBpc0h1YlZhcmlhYmxlXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gRW50aXR5VHlwZS5URU1QTEFURSkge1xyXG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gdGVtcGxhdGVNYXAuZ2V0KGlkKTtcclxuICAgICAgICBpZiAodGVtcGxhdGUpIHtcclxuICAgICAgICAgIC8vIFRlbXBsYXRlcyBoYXZlIG5vIGRlcGVuZGVuY2llcyAodGhleSBhcmUgbGVhZiBub2RlcylcclxuICAgICAgICAgIGRlcGVuZGVuY2llcyA9IFtdO1xyXG5cclxuICAgICAgICAgIHRoaXMubm9kZXMuc2V0KGlkLCB7XHJcbiAgICAgICAgICAgIGVudGl0eVR5cGU6IEVudGl0eVR5cGUuVEVNUExBVEUsXHJcbiAgICAgICAgICAgIGVudGl0eUlkOiBpZCxcclxuICAgICAgICAgICAgbmFtZTogdGVtcGxhdGUubmFtZSxcclxuICAgICAgICAgICAgZGF0YTogdGVtcGxhdGUsXHJcbiAgICAgICAgICAgIGRlcGVuZGVuY2llc1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyDsnZjsobTshLHsnYQg7YGQ7JeQIOy2lOqwgFxyXG4gICAgICBmb3IgKGNvbnN0IGRlcCBvZiBkZXBlbmRlbmNpZXMpIHtcclxuICAgICAgICBsZXQgdGFyZ2V0SWQgPSBkZXAudGFyZ2V0SWQ7XHJcblxyXG4gICAgICAgIC8vIG5hbWU6eHh4IO2Yle2DnCDihpIg7Iuk7KCcIElE66GcIOuzgO2ZmFxyXG4gICAgICAgIGlmICh0YXJnZXRJZCAmJiB0YXJnZXRJZC5zdGFydHNXaXRoKCduYW1lOicpKSB7XHJcbiAgICAgICAgICBjb25zdCBuYW1lID0gdGFyZ2V0SWQuc3Vic3RyaW5nKDUpO1xyXG4gICAgICAgICAgaWYgKGRlcC50YXJnZXRUeXBlID09PSBFbnRpdHlUeXBlLlZBUklBQkxFKSB7XHJcbiAgICAgICAgICAgIHRhcmdldElkID0gdmFyaWFibGVOYW1lVG9JZC5nZXQobmFtZSkgfHwgdGFyZ2V0SWQ7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGRlcC50YXJnZXRUeXBlID09PSBFbnRpdHlUeXBlLlRBRykge1xyXG4gICAgICAgICAgICB0YXJnZXRJZCA9IHRhZ05hbWVUb0lkLmdldChuYW1lKSB8fCB0YXJnZXRJZDtcclxuICAgICAgICAgIH0gZWxzZSBpZiAoZGVwLnRhcmdldFR5cGUgPT09IEVudGl0eVR5cGUuVEVNUExBVEUpIHtcclxuICAgICAgICAgICAgdGFyZ2V0SWQgPSB0ZW1wbGF0ZU5hbWVUb0lkLmdldChuYW1lKSB8fCB0YXJnZXRJZDtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGRlcC50YXJnZXRJZCA9IHRhcmdldElkO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gY3Z0Onh4eCDtmJXtg5wg4oaSIOyLpOygnCDthZztlIzrpr8gSUTroZwg67OA7ZmYXHJcbiAgICAgICAgaWYgKHRhcmdldElkICYmIHRhcmdldElkLnN0YXJ0c1dpdGgoJ2N2dDonKSkge1xyXG4gICAgICAgICAgY29uc3QgY3Z0VHlwZSA9IHRhcmdldElkLnN1YnN0cmluZyg0KTsgIC8vIFwiY3Z0OlwiIHByZWZpeCDsoJzqsbBcclxuICAgICAgICAgIHRhcmdldElkID0gdGVtcGxhdGVUeXBlVG9JZC5nZXQoY3Z0VHlwZSkgfHwgdGFyZ2V0SWQ7XHJcbiAgICAgICAgICBkZXAudGFyZ2V0SWQgPSB0YXJnZXRJZDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0YXJnZXRJZCAmJiAhcmVhY2hhYmxlSWRzLmhhcyh0YXJnZXRJZCkgJiYgIXRhcmdldElkLnN0YXJ0c1dpdGgoJ25hbWU6JykgJiYgIXRhcmdldElkLnN0YXJ0c1dpdGgoJ2N2dDonKSkge1xyXG4gICAgICAgICAgcXVldWUucHVzaCh7IHR5cGU6IGRlcC50YXJnZXRUeXBlLCBpZDogdGFyZ2V0SWQgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY3JlYXRpb25PcmRlciA9IHRoaXMudG9wb2xvZ2ljYWxTb3J0KCk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcm9vdElkOiB0YWdzWzBdPy50YWdJZCB8fCAnJyxcclxuICAgICAgcm9vdE5hbWU6IHRhZ3NbMF0/Lm5hbWUgfHwgJ1Vua25vd24nLFxyXG4gICAgICBub2RlczogdGhpcy5ub2RlcyxcclxuICAgICAgY3JlYXRpb25PcmRlclxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOydtOuypO2KuC3tg5zqt7gg7Jet67Cp7ZalIOyduOuNseyKpCDqtazstpVcclxuICAgKiDrqqjrk6Ag7YOc6re47JeQ7IScIHB1c2jtlZjripQg7J2067Kk7Yq466W8IOy2lOy2nO2VmOyXrCDsnbjrjbHsiqQg7IOd7ISxXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBidWlsZEV2ZW50VGFnSW5kZXgodGFnczogR1RNVGFnW10pOiBFdmVudFRhZ0luZGV4IHtcclxuICAgIGNvbnN0IGluZGV4OiBFdmVudFRhZ0luZGV4ID0ge307XHJcblxyXG4gICAgZm9yIChjb25zdCB0YWcgb2YgdGFncykge1xyXG4gICAgICBjb25zdCBldmVudHMgPSBleHRyYWN0UHVzaGVkRXZlbnRzKHRhZyk7XHJcbiAgICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XHJcbiAgICAgICAgaWYgKCFpbmRleFtldmVudF0pIHtcclxuICAgICAgICAgIGluZGV4W2V2ZW50XSA9IFtdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpbmRleFtldmVudF0ucHVzaCh0YWcudGFnSWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGluZGV4O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0dXBUYWcvVGVhcmRvd25UYWcg7Jet67Cp7ZalIOyduOuNseyKpCDqtazstpVcclxuICAgKiDrqqjrk6Ag7YOc6re47JeQ7IScIHNldHVwVGFnL3RlYXJkb3duVGFn7Jy866GcIOyCrOyaqe2VmOuKlCDtg5zqt7gg7J2066aE7J2EIOy2lOy2nO2VmOyXrCDsnbjrjbHsiqQg7IOd7ISxXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBidWlsZFRhZ1NlcXVlbmNlSW5kZXgodGFnczogR1RNVGFnW10pOiBUYWdTZXF1ZW5jZUluZGV4IHtcclxuICAgIGNvbnN0IHNldHVwVGFnVXNlcnMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nW10+KCk7XHJcbiAgICBjb25zdCB0ZWFyZG93blRhZ1VzZXJzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZ1tdPigpO1xyXG5cclxuICAgIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcclxuICAgICAgLy8gc2V0dXBUYWcg7J24642x7IqkIOq1rOy2lVxyXG4gICAgICBpZiAodGFnLnNldHVwVGFnKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCBzZXR1cCBvZiB0YWcuc2V0dXBUYWcpIHtcclxuICAgICAgICAgIGNvbnN0IHRhcmdldE5hbWUgPSBzZXR1cC50YWdOYW1lO1xyXG4gICAgICAgICAgaWYgKHRhcmdldE5hbWUpIHtcclxuICAgICAgICAgICAgaWYgKCFzZXR1cFRhZ1VzZXJzLmhhcyh0YXJnZXROYW1lKSkge1xyXG4gICAgICAgICAgICAgIHNldHVwVGFnVXNlcnMuc2V0KHRhcmdldE5hbWUsIFtdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBzZXR1cFRhZ1VzZXJzLmdldCh0YXJnZXROYW1lKSEucHVzaCh0YWcudGFnSWQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gdGVhcmRvd25UYWcg7J24642x7IqkIOq1rOy2lVxyXG4gICAgICBpZiAodGFnLnRlYXJkb3duVGFnKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCB0ZWFyZG93biBvZiB0YWcudGVhcmRvd25UYWcpIHtcclxuICAgICAgICAgIGNvbnN0IHRhcmdldE5hbWUgPSB0ZWFyZG93bi50YWdOYW1lO1xyXG4gICAgICAgICAgaWYgKHRhcmdldE5hbWUpIHtcclxuICAgICAgICAgICAgaWYgKCF0ZWFyZG93blRhZ1VzZXJzLmhhcyh0YXJnZXROYW1lKSkge1xyXG4gICAgICAgICAgICAgIHRlYXJkb3duVGFnVXNlcnMuc2V0KHRhcmdldE5hbWUsIFtdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0ZWFyZG93blRhZ1VzZXJzLmdldCh0YXJnZXROYW1lKSEucHVzaCh0YWcudGFnSWQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7IHNldHVwVGFnVXNlcnMsIHRlYXJkb3duVGFnVXNlcnMgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOu2hOyEnSDqsrDqs7wg7IOd7ISxIChBZ2VudCDrsJjtmZjsmqkpXHJcbiAgICovXHJcbiAgdG9BbmFseXNpc1Jlc3VsdChncmFwaDogRGVwZW5kZW5jeUdyYXBoKTogQW5hbHlzaXNSZXN1bHQge1xyXG4gICAgY29uc3Qgc3VtbWFyeSA9IHRoaXMuY3JlYXRlU3VtbWFyeSgpO1xyXG5cclxuICAgIGNvbnN0IGNyZWF0aW9uT3JkZXI6IENyZWF0aW9uT3JkZXJJdGVtW10gPSBncmFwaC5jcmVhdGlvbk9yZGVyLm1hcCgoaWQsIGluZGV4KSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vZGUgPSBncmFwaC5ub2Rlcy5nZXQoaWQpO1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0ZXA6IGluZGV4ICsgMSxcclxuICAgICAgICB0eXBlOiBub2RlPy5lbnRpdHlUeXBlIHx8IEVudGl0eVR5cGUuVkFSSUFCTEUsXHJcbiAgICAgICAgaWQsXHJcbiAgICAgICAgbmFtZTogbm9kZT8ubmFtZSB8fCAnVW5rbm93bidcclxuICAgICAgfTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG5vZGVzOiBSZWNvcmQ8c3RyaW5nLCBOb2RlSW5mbz4gPSB7fTtcclxuICAgIGZvciAoY29uc3QgW2lkLCBub2RlXSBvZiBncmFwaC5ub2Rlcykge1xyXG4gICAgICBub2Rlc1tpZF0gPSB7XHJcbiAgICAgICAgdHlwZTogbm9kZS5lbnRpdHlUeXBlLFxyXG4gICAgICAgIG5hbWU6IG5vZGUubmFtZSxcclxuICAgICAgICB2YXJpYWJsZVR5cGU6IG5vZGUudmFyaWFibGVUeXBlLFxyXG4gICAgICAgIGRlcGVuZGVuY2llczogbm9kZS5kZXBlbmRlbmNpZXMubWFwKGQgPT4gZC50YXJnZXRJZCksXHJcbiAgICAgICAgZGF0YTogbm9kZS5kYXRhXHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3VtbWFyeSxcclxuICAgICAgY3JlYXRpb25PcmRlcixcclxuICAgICAgbm9kZXNcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBQcml2YXRlIE1ldGhvZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgcHJpdmF0ZSByZXNldCgpOiB2b2lkIHtcclxuICAgIHRoaXMubm9kZXMuY2xlYXIoKTtcclxuICAgIHRoaXMudmlzaXRlZC5jbGVhcigpO1xyXG4gICAgdGhpcy52YXJpYWJsZU5hbWVDYWNoZS5jbGVhcigpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQkZT66GcIOydmOyhtOyEsSDtg5Dsg4lcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIGJmc1RyYXZlcnNlKFxyXG4gICAgZW50aXR5VHlwZTogRW50aXR5VHlwZSxcclxuICAgIGVudGl0eUlkOiBzdHJpbmdcclxuICApOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHF1ZXVlOiBBcnJheTx7IHR5cGU6IEVudGl0eVR5cGU7IGlkOiBzdHJpbmcgfT4gPSBbXHJcbiAgICAgIHsgdHlwZTogZW50aXR5VHlwZSwgaWQ6IGVudGl0eUlkIH1cclxuICAgIF07XHJcblxyXG4gICAgd2hpbGUgKHF1ZXVlLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgeyB0eXBlLCBpZCB9ID0gcXVldWUuc2hpZnQoKSE7XHJcblxyXG4gICAgICBpZiAodGhpcy52aXNpdGVkLmhhcyhpZCkpIGNvbnRpbnVlO1xyXG4gICAgICB0aGlzLnZpc2l0ZWQuYWRkKGlkKTtcclxuXHJcbiAgICAgIGNvbnN0IGVudGl0eSA9IGF3YWl0IHRoaXMuZmV0Y2hFbnRpdHkodHlwZSwgaWQpO1xyXG4gICAgICBpZiAoIWVudGl0eSkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCBkZXBlbmRlbmNpZXMgPSB0aGlzLmV4dHJhY3REZXBlbmRlbmNpZXModHlwZSwgZW50aXR5KTtcclxuXHJcbiAgICAgIGNvbnN0IG5vZGU6IERlcGVuZGVuY3lOb2RlID0ge1xyXG4gICAgICAgIGVudGl0eVR5cGU6IHR5cGUsXHJcbiAgICAgICAgZW50aXR5SWQ6IGlkLFxyXG4gICAgICAgIG5hbWU6IGVudGl0eS5uYW1lLFxyXG4gICAgICAgIGRhdGE6IGVudGl0eSxcclxuICAgICAgICBkZXBlbmRlbmNpZXNcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGlmICh0eXBlID09PSBFbnRpdHlUeXBlLlZBUklBQkxFKSB7XHJcbiAgICAgICAgbm9kZS52YXJpYWJsZVR5cGUgPSAoZW50aXR5IGFzIEdUTVZhcmlhYmxlKS50eXBlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLm5vZGVzLnNldChpZCwgbm9kZSk7XHJcblxyXG4gICAgICAvLyDsnZjsobTshLHsnYQg7YGQ7JeQIOy2lOqwgFxyXG4gICAgICBmb3IgKGNvbnN0IGRlcCBvZiBkZXBlbmRlbmNpZXMpIHtcclxuICAgICAgICBpZiAoIXRoaXMudmlzaXRlZC5oYXMoZGVwLnRhcmdldElkKSkge1xyXG4gICAgICAgICAgcXVldWUucHVzaCh7IHR5cGU6IGRlcC50YXJnZXRUeXBlLCBpZDogZGVwLnRhcmdldElkIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7JeU7Yuw7YuwIOyhsO2ajFxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgZmV0Y2hFbnRpdHkoXHJcbiAgICB0eXBlOiBFbnRpdHlUeXBlLFxyXG4gICAgaWQ6IHN0cmluZ1xyXG4gICk6IFByb21pc2U8R1RNVGFnIHwgR1RNVHJpZ2dlciB8IEdUTVZhcmlhYmxlIHwgR1RNVGVtcGxhdGUgfCBudWxsPiB7XHJcbiAgICAvLyBudWxsL3VuZGVmaW5lZCDssrTtgaxcclxuICAgIGlmICghaWQpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gbmFtZTp4eHgg7ZiV7YOcIOKGkiDsnbTrpoTsnLzroZwg6rKA7IOJXHJcbiAgICBpZiAoaWQuc3RhcnRzV2l0aCgnbmFtZTonKSkge1xyXG4gICAgICBjb25zdCBuYW1lID0gaWQuc3Vic3RyaW5nKDUpO1xyXG4gICAgICByZXR1cm4gdGhpcy5maW5kQnlOYW1lKHR5cGUsIG5hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIElE66GcIOyngeygkSDsobDtmoxcclxuICAgIHN3aXRjaCAodHlwZSkge1xyXG4gICAgICBjYXNlIEVudGl0eVR5cGUuVEFHOlxyXG4gICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZ2V0VGFnKGlkKTtcclxuICAgICAgY2FzZSBFbnRpdHlUeXBlLlRSSUdHRVI6XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci5nZXRUcmlnZ2VyKGlkKTtcclxuICAgICAgY2FzZSBFbnRpdHlUeXBlLlZBUklBQkxFOlxyXG4gICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZ2V0VmFyaWFibGUoaWQpO1xyXG4gICAgICBjYXNlIEVudGl0eVR5cGUuVEVNUExBVEU6XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci5nZXRUZW1wbGF0ZShpZCk7XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDsnbTrpoTsnLzroZwg7JeU7Yuw7YuwIOqygOyDiVxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgZmluZEJ5TmFtZShcclxuICAgIHR5cGU6IEVudGl0eVR5cGUsXHJcbiAgICBuYW1lOiBzdHJpbmdcclxuICApOiBQcm9taXNlPEdUTVRhZyB8IEdUTVRyaWdnZXIgfCBHVE1WYXJpYWJsZSB8IEdUTVRlbXBsYXRlIHwgbnVsbD4ge1xyXG4gICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgIGNhc2UgRW50aXR5VHlwZS5WQVJJQUJMRTpcclxuICAgICAgICAvLyDsupDsi5wg7ZmV7J24XHJcbiAgICAgICAgaWYgKHRoaXMudmFyaWFibGVOYW1lQ2FjaGUuaGFzKG5hbWUpKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy52YXJpYWJsZU5hbWVDYWNoZS5nZXQobmFtZSkgfHwgbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgdmFyaWFibGUgPSBhd2FpdCB0aGlzLmFkYXB0ZXIuZmluZFZhcmlhYmxlQnlOYW1lKG5hbWUpO1xyXG4gICAgICAgIHRoaXMudmFyaWFibGVOYW1lQ2FjaGUuc2V0KG5hbWUsIHZhcmlhYmxlKTtcclxuICAgICAgICByZXR1cm4gdmFyaWFibGU7XHJcblxyXG4gICAgICBjYXNlIEVudGl0eVR5cGUuVEFHOlxyXG4gICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZmluZFRhZ0J5TmFtZShuYW1lKTtcclxuXHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDsnZjsobTshLEg7LaU7LacXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBleHRyYWN0RGVwZW5kZW5jaWVzKFxyXG4gICAgdHlwZTogRW50aXR5VHlwZSxcclxuICAgIGVudGl0eTogR1RNRW50aXR5XHJcbiAgKTogRGVwZW5kZW5jeUVkZ2VbXSB7XHJcbiAgICBzd2l0Y2ggKHR5cGUpIHtcclxuICAgICAgY2FzZSBFbnRpdHlUeXBlLlRBRzpcclxuICAgICAgICByZXR1cm4gZXh0cmFjdFRhZ0RlcGVuZGVuY2llcyhlbnRpdHkgYXMgR1RNVGFnKTtcclxuICAgICAgY2FzZSBFbnRpdHlUeXBlLlRSSUdHRVI6XHJcbiAgICAgICAgcmV0dXJuIGV4dHJhY3RUcmlnZ2VyRGVwZW5kZW5jaWVzKGVudGl0eSBhcyBHVE1UcmlnZ2VyKTtcclxuICAgICAgY2FzZSBFbnRpdHlUeXBlLlZBUklBQkxFOlxyXG4gICAgICAgIHJldHVybiBleHRyYWN0VmFyaWFibGVEZXBlbmRlbmNpZXMoZW50aXR5IGFzIEdUTVZhcmlhYmxlKTtcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBuYW1lOiDssLjsobDrpbwg7Iuk7KCcIElE66GcIOuzgO2ZmFxyXG4gICAqL1xyXG4gIHByaXZhdGUgcmVzb2x2ZU5hbWVSZWZlcmVuY2VzKHZhcmlhYmxlczogR1RNVmFyaWFibGVbXSk6IHZvaWQge1xyXG4gICAgY29uc3QgbmFtZVRvSWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xyXG4gICAgZm9yIChjb25zdCB2IG9mIHZhcmlhYmxlcykge1xyXG4gICAgICBuYW1lVG9JZC5zZXQodi5uYW1lLCB2LnZhcmlhYmxlSWQpO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAoY29uc3QgWywgbm9kZV0gb2YgdGhpcy5ub2Rlcykge1xyXG4gICAgICBmb3IgKGNvbnN0IGRlcCBvZiBub2RlLmRlcGVuZGVuY2llcykge1xyXG4gICAgICAgIGlmIChkZXAudGFyZ2V0SWQgJiYgZGVwLnRhcmdldElkLnN0YXJ0c1dpdGgoJ25hbWU6JykgJiYgZGVwLnZhcmlhYmxlTmFtZSkge1xyXG4gICAgICAgICAgY29uc3QgcmVhbElkID0gbmFtZVRvSWQuZ2V0KGRlcC52YXJpYWJsZU5hbWUpO1xyXG4gICAgICAgICAgaWYgKHJlYWxJZCkge1xyXG4gICAgICAgICAgICBkZXAudGFyZ2V0SWQgPSByZWFsSWQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUb3BvbG9naWNhbCBTb3J0IChLYWhuJ3MgQWxnb3JpdGhtKVxyXG4gICAqIOqwnOyEoDog64iE652965CcIOuFuOuTnCDqsoDspp0g67CPIOuzteq1rFxyXG4gICAqL1xyXG4gIHByaXZhdGUgdG9wb2xvZ2ljYWxTb3J0KCk6IHN0cmluZ1tdIHtcclxuICAgIGNvbnN0IGluRGVncmVlOiBNYXA8c3RyaW5nLCBudW1iZXI+ID0gbmV3IE1hcCgpO1xyXG5cclxuICAgIC8vIOyLpOygnCBJROuhnCDrs4DtmZjrkJwgZGVwZW5kZW5jeSDrp7Ug6rWs7LaVIChuYW1lOnh4eCwgY3Z0Onh4eCDsspjrpqwpXHJcbiAgICBjb25zdCByZXNvbHZlZERlcHM6IE1hcDxzdHJpbmcsIFNldDxzdHJpbmc+PiA9IG5ldyBNYXAoKTtcclxuICAgIGZvciAoY29uc3QgW2lkLCBub2RlXSBvZiB0aGlzLm5vZGVzKSB7XHJcbiAgICAgIGNvbnN0IGRlcHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICAgICAgZm9yIChjb25zdCBkZXAgb2Ygbm9kZS5kZXBlbmRlbmNpZXMpIHtcclxuICAgICAgICAvLyDsi6TsoJzroZwgbm9kZXPsl5Ag7KG07J6s7ZWY64qUIGRlcGVuZGVuY3nrp4wg7LaU6rCAXHJcbiAgICAgICAgaWYgKHRoaXMubm9kZXMuaGFzKGRlcC50YXJnZXRJZCkpIHtcclxuICAgICAgICAgIGRlcHMuYWRkKGRlcC50YXJnZXRJZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJlc29sdmVkRGVwcy5zZXQoaWQsIGRlcHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAoY29uc3QgW2lkXSBvZiB0aGlzLm5vZGVzKSB7XHJcbiAgICAgIGluRGVncmVlLnNldChpZCwgMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSW4tZGVncmVlIOqzhOyCsCAocmVzb2x2ZWREZXBzIOyCrOyaqSlcclxuICAgIGZvciAoY29uc3QgW25vZGVJZCwgZGVwc10gb2YgcmVzb2x2ZWREZXBzKSB7XHJcbiAgICAgIGluRGVncmVlLnNldChub2RlSWQsIGRlcHMuc2l6ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSW4tZGVncmVl6rCAIDDsnbgg64W465Oc67aA7YSwIOyLnOyekVxyXG4gICAgY29uc3QgcXVldWU6IHN0cmluZ1tdID0gW107XHJcbiAgICBmb3IgKGNvbnN0IFtpZCwgZGVncmVlXSBvZiBpbkRlZ3JlZSkge1xyXG4gICAgICBpZiAoZGVncmVlID09PSAwKSB7XHJcbiAgICAgICAgcXVldWUucHVzaChpZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XHJcbiAgICBjb25zdCBwcm9jZXNzZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuXHJcbiAgICB3aGlsZSAocXVldWUubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBjdXJyZW50ID0gcXVldWUuc2hpZnQoKSE7XHJcbiAgICAgIHJlc3VsdC5wdXNoKGN1cnJlbnQpO1xyXG4gICAgICBwcm9jZXNzZWQuYWRkKGN1cnJlbnQpO1xyXG5cclxuICAgICAgLy8gY3VycmVudOulvCDsnZjsobTtlZjripQg64W465Oc65Ok7J2YIGluLWRlZ3JlZSDqsJDshoxcclxuICAgICAgZm9yIChjb25zdCBbaWQsIGRlcHNdIG9mIHJlc29sdmVkRGVwcykge1xyXG4gICAgICAgIGlmIChkZXBzLmhhcyhjdXJyZW50KSAmJiAhcHJvY2Vzc2VkLmhhcyhpZCkpIHtcclxuICAgICAgICAgIGNvbnN0IG5ld0RlZ3JlZSA9IChpbkRlZ3JlZS5nZXQoaWQpIHx8IDApIC0gMTtcclxuICAgICAgICAgIGluRGVncmVlLnNldChpZCwgbmV3RGVncmVlKTtcclxuXHJcbiAgICAgICAgICBpZiAobmV3RGVncmVlID09PSAwKSB7XHJcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goaWQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIOuIhOudveuQnCDrhbjrk5wg6rKA7KadIOuwjyDrs7XqtaxcclxuICAgIGlmIChyZXN1bHQubGVuZ3RoICE9PSB0aGlzLm5vZGVzLnNpemUpIHtcclxuICAgICAgY29uc29sZS53YXJuKGBbVG9wb2xvZ2ljYWxTb3J0XSBJbmNvbXBsZXRlOiAke3Jlc3VsdC5sZW5ndGh9LyR7dGhpcy5ub2Rlcy5zaXplfSBub2RlcyBwcm9jZXNzZWRgKTtcclxuXHJcbiAgICAgIC8vIOuIhOudveuQnCDrhbjrk5wg7LC+7JWE7IScIOy2lOqwgCAo7Iic7ZmYIOydmOyhtOyEsSDrmJDripQg66+47ZW06rKwIOywuOyhsClcclxuICAgICAgZm9yIChjb25zdCBbaWQsIG5vZGVdIG9mIHRoaXMubm9kZXMpIHtcclxuICAgICAgICBpZiAoIXByb2Nlc3NlZC5oYXMoaWQpKSB7XHJcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtUb3BvbG9naWNhbFNvcnRdIEFkZGluZyBtaXNzaW5nIG5vZGU6ICR7bm9kZS5lbnRpdHlUeXBlfSBcIiR7bm9kZS5uYW1lfVwiICgke2lkfSlgKTtcclxuICAgICAgICAgIHJlc3VsdC5wdXNoKGlkKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGhpcy5zb3J0QnlFbnRpdHlUeXBlKHJlc3VsdCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDtg4DsnoXrs4Qg7KCV66CsIChUZW1wbGF0ZSDihpIgVmFyaWFibGUg4oaSIFRyaWdnZXIg4oaSIFRhZylcclxuICAgKi9cclxuICBwcml2YXRlIHNvcnRCeUVudGl0eVR5cGUoaWRzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcclxuICAgIGNvbnN0IHR5cGVPcmRlcjogUmVjb3JkPEVudGl0eVR5cGUsIG51bWJlcj4gPSB7XHJcbiAgICAgIFtFbnRpdHlUeXBlLlRFTVBMQVRFXTogMCxcclxuICAgICAgW0VudGl0eVR5cGUuVkFSSUFCTEVdOiAxLFxyXG4gICAgICBbRW50aXR5VHlwZS5UUklHR0VSXTogMixcclxuICAgICAgW0VudGl0eVR5cGUuVEFHXTogMyxcclxuICAgICAgW0VudGl0eVR5cGUuRk9MREVSXTogNFxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gaWRzLnNvcnQoKGEsIGIpID0+IHtcclxuICAgICAgY29uc3Qgbm9kZUEgPSB0aGlzLm5vZGVzLmdldChhKTtcclxuICAgICAgY29uc3Qgbm9kZUIgPSB0aGlzLm5vZGVzLmdldChiKTtcclxuXHJcbiAgICAgIGlmICghbm9kZUEgfHwgIW5vZGVCKSByZXR1cm4gMDtcclxuXHJcbiAgICAgIHJldHVybiAodHlwZU9yZGVyW25vZGVBLmVudGl0eVR5cGVdID8/IDk5KSAtICh0eXBlT3JkZXJbbm9kZUIuZW50aXR5VHlwZV0gPz8gOTkpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDsmpTslb0g7IOd7ISxXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjcmVhdGVTdW1tYXJ5KCk6IEFuYWx5c2lzU3VtbWFyeSB7XHJcbiAgICBsZXQgdGFncyA9IDA7XHJcbiAgICBsZXQgdHJpZ2dlcnMgPSAwO1xyXG4gICAgbGV0IHZhcmlhYmxlcyA9IDA7XHJcbiAgICBsZXQgdGVtcGxhdGVzID0gMDtcclxuICAgIGxldCBqc1ZhcmlhYmxlc1dpdGhJbnRlcm5hbFJlZnMgPSAwO1xyXG5cclxuICAgIGZvciAoY29uc3QgWywgbm9kZV0gb2YgdGhpcy5ub2Rlcykge1xyXG4gICAgICBzd2l0Y2ggKG5vZGUuZW50aXR5VHlwZSkge1xyXG4gICAgICAgIGNhc2UgRW50aXR5VHlwZS5UQUc6XHJcbiAgICAgICAgICB0YWdzKys7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIEVudGl0eVR5cGUuVFJJR0dFUjpcclxuICAgICAgICAgIHRyaWdnZXJzKys7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIEVudGl0eVR5cGUuVkFSSUFCTEU6XHJcbiAgICAgICAgICB2YXJpYWJsZXMrKztcclxuICAgICAgICAgIGlmIChub2RlLnZhcmlhYmxlVHlwZSA9PT0gJ2pzbScpIHtcclxuICAgICAgICAgICAgY29uc3QgaGFzSW50ZXJuYWxSZWZzID0gbm9kZS5kZXBlbmRlbmNpZXMuc29tZShcclxuICAgICAgICAgICAgICBkID0+IGQuZGVwZW5kZW5jeVR5cGUgPT09IERlcGVuZGVuY3lUeXBlLkpTX0lOVEVSTkFMX1JFRlxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICBpZiAoaGFzSW50ZXJuYWxSZWZzKSB7XHJcbiAgICAgICAgICAgICAganNWYXJpYWJsZXNXaXRoSW50ZXJuYWxSZWZzKys7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRW50aXR5VHlwZS5URU1QTEFURTpcclxuICAgICAgICAgIHRlbXBsYXRlcysrO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB0b3RhbDogdGhpcy5ub2Rlcy5zaXplLFxyXG4gICAgICB0YWdzLFxyXG4gICAgICB0cmlnZ2VycyxcclxuICAgICAgdmFyaWFibGVzLFxyXG4gICAgICB0ZW1wbGF0ZXMsXHJcbiAgICAgIGpzVmFyaWFibGVzV2l0aEludGVybmFsUmVmc1xyXG4gICAgfTtcclxuICB9XHJcbn1cclxuIl19