/**
 * Dependency Graph Builder
 *
 * GTM MCP를 통해 엔티티를 조회하고 의존성 그래프를 구축합니다.
 * - BFS로 전체 의존성 탐색
 * - Topological Sort로 생성 순서 결정
 */

import {
  EntityType,
  GTMTag,
  GTMTrigger,
  GTMVariable,
  GTMTemplate,
  GTMEntity
} from '../types/gtm';
import {
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  AnalysisSummary,
  AnalysisResult,
  CreationOrderItem,
  NodeInfo,
  DependencyType
} from '../types/dependency';
import {
  extractTagDependencies,
  extractTriggerDependencies,
  extractVariableDependencies,
  extractCustomEventName,
  extractPushedEvents
} from './parsers';

// ==================== MCP Adapter Interface ====================

/**
 * GTM MCP 호출을 위한 어댑터 인터페이스
 * Agent가 실제 MCP 호출을 주입합니다.
 */
export interface GTMMCPAdapter {
  getTag(tagId: string): Promise<GTMTag | null>;
  getTrigger(triggerId: string): Promise<GTMTrigger | null>;
  getVariable(variableId: string): Promise<GTMVariable | null>;
  getTemplate(templateId: string): Promise<GTMTemplate | null>;
  findVariableByName(name: string): Promise<GTMVariable | null>;
  findTagByName(name: string): Promise<GTMTag | null>;
  findTemplateByName?(name: string): Promise<GTMTemplate | null>;
  listTags(): Promise<GTMTag[]>;
  listTriggers(): Promise<GTMTrigger[]>;
  listVariables(): Promise<GTMVariable[]>;
  listTemplates(): Promise<GTMTemplate[]>;
  createTemplate?(config: Partial<GTMTemplate>): Promise<GTMTemplate>;
}

// ==================== Build Options ====================

/**
 * 이벤트-태그 역방향 인덱스
 * eventName → 해당 이벤트를 push하는 태그 ID 목록
 */
interface EventTagIndex {
  [eventName: string]: string[];
}

/**
 * SetupTag/TeardownTag 역방향 인덱스
 * tagName → 해당 태그를 setupTag 또는 teardownTag으로 사용하는 태그 ID 목록
 */
interface TagSequenceIndex {
  setupTagUsers: Map<string, string[]>;    // tagName → 이 태그를 setupTag으로 사용하는 태그들
  teardownTagUsers: Map<string, string[]>; // tagName → 이 태그를 teardownTag으로 사용하는 태그들
}

/**
 * 그래프 빌드 옵션
 */
export interface BuildOptions {
  /**
   * 역추적 활성화 여부
   * true: CustomEvent 트리거가 감지하는 이벤트를 push하는 태그도 추적
   * true: setupTag/teardownTag으로 선택된 태그를 사용하는 태그도 추적
   */
  enableReverseTracking?: boolean;

  /**
   * 역추적용 전체 워크스페이스 태그
   * 선택된 태그와 별도로, 역추적 시 검색 대상이 되는 모든 태그
   */
  allWorkspaceTags?: GTMTag[];
}

// ==================== Graph Builder ====================

export class DependencyGraphBuilder {
  private adapter: GTMMCPAdapter;
  private nodes: Map<string, DependencyNode> = new Map();
  private visited: Set<string> = new Set();
  private variableNameCache: Map<string, GTMVariable | null> = new Map();

  constructor(adapter: GTMMCPAdapter) {
    this.adapter = adapter;
  }

  /**
   * 태그에서 시작하여 전체 의존성 그래프 구축
   */
  async buildFromTag(tagId: string): Promise<DependencyGraph> {
    this.reset();
    await this.bfsTraverse(EntityType.TAG, tagId);
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
  async buildFromTags(tagIds: string[]): Promise<DependencyGraph> {
    this.reset();

    for (const tagId of tagIds) {
      await this.bfsTraverse(EntityType.TAG, tagId);
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
  buildFromEntities(
    tags: GTMTag[],
    triggers: GTMTrigger[],
    variables: GTMVariable[],
    options?: BuildOptions,
    templates?: GTMTemplate[]
  ): DependencyGraph {
    this.reset();

    // 인덱스 맵 구축
    const triggerMap = new Map<string, GTMTrigger>();
    const variableMap = new Map<string, GTMVariable>();
    const templateMap = new Map<string, GTMTemplate>();
    const variableNameToId = new Map<string, string>();
    const tagNameToId = new Map<string, string>();
    const templateNameToId = new Map<string, string>();
    const templateTypeToId = new Map<string, string>();  // cvt_XXX -> templateId 매핑
    const tagMap = new Map<string, GTMTag>();

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
    const eventTagIndex: EventTagIndex = options?.enableReverseTracking
      ? this.buildEventTagIndex(allTagsForReverse)
      : {};

    // SetupTag/TeardownTag 역방향 인덱스 구축 (역추적 활성화 시)
    const tagSequenceIndex: TagSequenceIndex = options?.enableReverseTracking
      ? this.buildTagSequenceIndex(allTagsForReverse)
      : { setupTagUsers: new Map(), teardownTagUsers: new Map() };

    // BFS로 선택된 태그에서 도달 가능한 엔티티만 수집
    const reachableIds = new Set<string>();
    const queue: Array<{ type: EntityType; id: string }> = [];

    // 시작점: 선택된 태그들
    for (const tag of tags) {
      queue.push({ type: EntityType.TAG, id: tag.tagId });
    }

    while (queue.length > 0) {
      const { type, id } = queue.shift()!;

      if (reachableIds.has(id)) continue;
      reachableIds.add(id);

      let dependencies: DependencyEdge[] = [];

      if (type === EntityType.TAG) {
        const tag = tagMap.get(id) || tags.find(t => t.tagId === id);
        if (tag) {
          dependencies = extractTagDependencies(tag);

          // 역추적: 이 태그를 setupTag 또는 teardownTag으로 사용하는 다른 태그들 발견
          // NOTE: 역추적은 BFS 발견(discovery)용으로만 사용. 의존성 엣지를 추가하지 않음.
          // 생성 순서는 forward dependency (parsers.ts extractTagDependencies)가 결정.
          // 잘못된 방향의 엣지를 추가하면 순환 의존성이 발생하여 topological sort가 깨짐.
          if (options?.enableReverseTracking) {
            const setupUsers = tagSequenceIndex.setupTagUsers.get(tag.name) || [];
            const teardownUsers = tagSequenceIndex.teardownTagUsers.get(tag.name) || [];

            for (const userTagId of setupUsers) {
              if (!reachableIds.has(userTagId)) {
                queue.push({ type: EntityType.TAG, id: userTagId });
              }
            }

            for (const userTagId of teardownUsers) {
              if (!reachableIds.has(userTagId)) {
                queue.push({ type: EntityType.TAG, id: userTagId });
              }
            }
          }

          this.nodes.set(id, {
            entityType: EntityType.TAG,
            entityId: id,
            name: tag.name,
            data: tag,
            dependencies
          });
        }
      } else if (type === EntityType.TRIGGER) {
        const trigger = triggerMap.get(id);
        if (trigger) {
          dependencies = extractTriggerDependencies(trigger);

          // 역추적: CustomEvent 트리거가 감지하는 이벤트를 push하는 태그 발견
          // NOTE: 역추적은 BFS 발견(discovery)용으로만 사용. 의존성 엣지를 추가하지 않음.
          // 이벤트를 push하는 태그를 그래프에 포함시키되, 생성 순서에는 영향 없음.
          if (options?.enableReverseTracking) {
            const eventName = extractCustomEventName(trigger);
            if (eventName) {
              const pusherTagIds = eventTagIndex[eventName] || [];
              for (const pusherTagId of pusherTagIds) {
                if (!reachableIds.has(pusherTagId)) {
                  const pusherTag = tagMap.get(pusherTagId);
                  if (pusherTag) {
                    queue.push({ type: EntityType.TAG, id: pusherTagId });
                  }
                }
              }
            }
          }

          this.nodes.set(id, {
            entityType: EntityType.TRIGGER,
            entityId: id,
            name: trigger.name,
            data: trigger,
            dependencies
          });
        }
      } else if (type === EntityType.VARIABLE) {
        const variable = variableMap.get(id);
        if (variable) {
          // 허브 변수 타입 (gtes, gas)은 하위 의존성 추적 제외
          // 이런 공유 설정 변수는 타겟에 이미 존재하거나 별도 관리됨
          const isHubVariable = ['gtes', 'gas'].includes(variable.type);
          dependencies = isHubVariable ? [] : extractVariableDependencies(variable);

          this.nodes.set(id, {
            entityType: EntityType.VARIABLE,
            entityId: id,
            name: variable.name,
            data: variable,
            variableType: variable.type,
            dependencies,
            isHubVariable
          });
        }
      } else if (type === EntityType.TEMPLATE) {
        const template = templateMap.get(id);
        if (template) {
          // Templates have no dependencies (they are leaf nodes)
          dependencies = [];

          this.nodes.set(id, {
            entityType: EntityType.TEMPLATE,
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
          if (dep.targetType === EntityType.VARIABLE) {
            targetId = variableNameToId.get(name) || targetId;
          } else if (dep.targetType === EntityType.TAG) {
            targetId = tagNameToId.get(name) || targetId;
          } else if (dep.targetType === EntityType.TEMPLATE) {
            targetId = templateNameToId.get(name) || targetId;
          }
          dep.targetId = targetId;
        }

        // cvt:xxx 형태 → 실제 템플릿 ID로 변환
        if (targetId && targetId.startsWith('cvt:')) {
          const cvtType = targetId.substring(4);  // "cvt:" prefix 제거
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
  private buildEventTagIndex(tags: GTMTag[]): EventTagIndex {
    const index: EventTagIndex = {};

    for (const tag of tags) {
      const events = extractPushedEvents(tag);
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
  private buildTagSequenceIndex(tags: GTMTag[]): TagSequenceIndex {
    const setupTagUsers = new Map<string, string[]>();
    const teardownTagUsers = new Map<string, string[]>();

    for (const tag of tags) {
      // setupTag 인덱스 구축
      if (tag.setupTag) {
        for (const setup of tag.setupTag) {
          const targetName = setup.tagName;
          if (targetName) {
            if (!setupTagUsers.has(targetName)) {
              setupTagUsers.set(targetName, []);
            }
            setupTagUsers.get(targetName)!.push(tag.tagId);
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
            teardownTagUsers.get(targetName)!.push(tag.tagId);
          }
        }
      }
    }

    return { setupTagUsers, teardownTagUsers };
  }

  /**
   * 분석 결과 생성 (Agent 반환용)
   */
  toAnalysisResult(graph: DependencyGraph): AnalysisResult {
    const summary = this.createSummary();

    const creationOrder: CreationOrderItem[] = graph.creationOrder.map((id, index) => {
      const node = graph.nodes.get(id);
      return {
        step: index + 1,
        type: node?.entityType || EntityType.VARIABLE,
        id,
        name: node?.name || 'Unknown'
      };
    });

    const nodes: Record<string, NodeInfo> = {};
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

  private reset(): void {
    this.nodes.clear();
    this.visited.clear();
    this.variableNameCache.clear();
  }

  /**
   * BFS로 의존성 탐색
   */
  private async bfsTraverse(
    entityType: EntityType,
    entityId: string
  ): Promise<void> {
    const queue: Array<{ type: EntityType; id: string }> = [
      { type: entityType, id: entityId }
    ];

    while (queue.length > 0) {
      const { type, id } = queue.shift()!;

      if (this.visited.has(id)) continue;
      this.visited.add(id);

      const entity = await this.fetchEntity(type, id);
      if (!entity) continue;

      const dependencies = this.extractDependencies(type, entity);

      const node: DependencyNode = {
        entityType: type,
        entityId: id,
        name: entity.name,
        data: entity,
        dependencies
      };

      if (type === EntityType.VARIABLE) {
        node.variableType = (entity as GTMVariable).type;
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
  private async fetchEntity(
    type: EntityType,
    id: string
  ): Promise<GTMTag | GTMTrigger | GTMVariable | GTMTemplate | null> {
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
      case EntityType.TAG:
        return this.adapter.getTag(id);
      case EntityType.TRIGGER:
        return this.adapter.getTrigger(id);
      case EntityType.VARIABLE:
        return this.adapter.getVariable(id);
      case EntityType.TEMPLATE:
        return this.adapter.getTemplate(id);
      default:
        return null;
    }
  }

  /**
   * 이름으로 엔티티 검색
   */
  private async findByName(
    type: EntityType,
    name: string
  ): Promise<GTMTag | GTMTrigger | GTMVariable | GTMTemplate | null> {
    switch (type) {
      case EntityType.VARIABLE:
        // 캐시 확인
        if (this.variableNameCache.has(name)) {
          return this.variableNameCache.get(name) || null;
        }
        const variable = await this.adapter.findVariableByName(name);
        this.variableNameCache.set(name, variable);
        return variable;

      case EntityType.TAG:
        return this.adapter.findTagByName(name);

      default:
        return null;
    }
  }

  /**
   * 의존성 추출
   */
  private extractDependencies(
    type: EntityType,
    entity: GTMEntity
  ): DependencyEdge[] {
    switch (type) {
      case EntityType.TAG:
        return extractTagDependencies(entity as GTMTag);
      case EntityType.TRIGGER:
        return extractTriggerDependencies(entity as GTMTrigger);
      case EntityType.VARIABLE:
        return extractVariableDependencies(entity as GTMVariable);
      default:
        return [];
    }
  }

  /**
   * name: 참조를 실제 ID로 변환
   */
  private resolveNameReferences(variables: GTMVariable[]): void {
    const nameToId = new Map<string, string>();
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
  private topologicalSort(): string[] {
    const inDegree: Map<string, number> = new Map();

    // 실제 ID로 변환된 dependency 맵 구축 (name:xxx, cvt:xxx 처리)
    const resolvedDeps: Map<string, Set<string>> = new Map();
    for (const [id, node] of this.nodes) {
      const deps = new Set<string>();
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
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const result: string[] = [];
    const processed = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
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
  private sortByEntityType(ids: string[]): string[] {
    const typeOrder: Record<EntityType, number> = {
      [EntityType.TEMPLATE]: 0,
      [EntityType.VARIABLE]: 1,
      [EntityType.TRIGGER]: 2,
      [EntityType.TAG]: 3,
      [EntityType.FOLDER]: 4
    };

    return ids.sort((a, b) => {
      const nodeA = this.nodes.get(a);
      const nodeB = this.nodes.get(b);

      if (!nodeA || !nodeB) return 0;

      return (typeOrder[nodeA.entityType] ?? 99) - (typeOrder[nodeB.entityType] ?? 99);
    });
  }

  /**
   * 요약 생성
   */
  private createSummary(): AnalysisSummary {
    let tags = 0;
    let triggers = 0;
    let variables = 0;
    let templates = 0;
    let jsVariablesWithInternalRefs = 0;

    for (const [, node] of this.nodes) {
      switch (node.entityType) {
        case EntityType.TAG:
          tags++;
          break;
        case EntityType.TRIGGER:
          triggers++;
          break;
        case EntityType.VARIABLE:
          variables++;
          if (node.variableType === 'jsm') {
            const hasInternalRefs = node.dependencies.some(
              d => d.dependencyType === DependencyType.JS_INTERNAL_REF
            );
            if (hasInternalRefs) {
              jsVariablesWithInternalRefs++;
            }
          }
          break;
        case EntityType.TEMPLATE:
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
