/**
 * Planner Agent
 * 신규 태그 판단 및 생성 계획 수립
 */

import {
  ReferenceMatcher,
  AnalysisResult,
  CreationPlan,
  CreationStep,
  EntityType,
  GTMTag,
  GTMTrigger,
  GTMVariable,
  GTMTemplate
} from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';
import { TargetEntities } from '../types/workflow';

// ==================== Request/Response Types ====================

export interface CreatePlanRequest {
  analysisResult: AnalysisResult;
  sourceEntities: {
    tags: GTMTag[];
    triggers: GTMTrigger[];
    variables: GTMVariable[];
    templates: GTMTemplate[];
  };
  nameMap?: Map<string, string>;
  skipExisting?: boolean;
  // Pre-loaded target entities to avoid duplicate API calls
  targetEntities?: TargetEntities;
}

export interface FindSimilarRequest {
  sourceTag: GTMTag;
  threshold?: number;
}

export interface CheckNewTagRequest {
  tagName: string;
  eventName?: string;
}

// ==================== Planner Agent ====================

export class PlannerAgent extends BaseAgent {
  private matcher?: ReferenceMatcher;

  constructor() {
    super('planner');
  }

  /**
   * 요청 처리
   */
  async execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>> {
    this.validateContext();

    switch (request.action) {
      case 'createPlan':
        return this.createPlan(request.data as CreatePlanRequest) as Promise<AgentResponse<R>>;

      case 'findSimilar':
        return this.findSimilarTags(request.data as FindSimilarRequest) as Promise<AgentResponse<R>>;

      case 'checkNewTag':
        return this.checkNewTag(request.data as CheckNewTagRequest) as Promise<AgentResponse<R>>;

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  /**
   * 생성 계획 수립
   */
  private async createPlan(
    request: CreatePlanRequest
  ): Promise<AgentResponse<CreationPlan>> {
    return this.safeExecute(
      { action: 'createPlan', data: request, context: this.context! },
      async () => {
        const { analysisResult, sourceEntities, nameMap, skipExisting, targetEntities } = request;

        this.logger.info('Creating execution plan', {
          totalEntities: analysisResult.summary.total,
          templates: analysisResult.summary.templates,
          creationOrder: analysisResult.creationOrder.length,
          usingCachedTargetEntities: !!targetEntities
        });

        // Use pre-loaded target entities if available, otherwise fetch from API
        let targetTags: GTMTag[];
        let targetTriggers: GTMTrigger[];
        let targetVariables: GTMVariable[];
        let targetTemplates: GTMTemplate[];

        if (targetEntities) {
          // Use cached target entities (avoids duplicate API calls)
          targetTags = targetEntities.tags;
          targetTriggers = targetEntities.triggers;
          targetVariables = targetEntities.variables;
          targetTemplates = targetEntities.templates;
          this.logger.info('Using cached target entities', {
            loadedAt: new Date(targetEntities.loadedAt).toISOString()
          });
        } else {
          // Fallback: fetch from API (for backward compatibility)
          this.logger.warn('No cached target entities, fetching from API');
          [targetTags, targetTriggers, targetVariables, targetTemplates] = await Promise.all([
            this.mcp!.listTags(),
            this.mcp!.listTriggers(),
            this.mcp!.listVariables(),
            this.mcp!.listTemplates()
          ]);
        }

        // 템플릿 이름-ID 매핑 (중복 검사용)
        const targetTemplateMap = new Map<string, GTMTemplate>();
        for (const t of targetTemplates) {
          targetTemplateMap.set(t.name, t);
        }

        this.matcher = new ReferenceMatcher(targetTags, targetTriggers, targetVariables);

        const steps: CreationStep[] = [];
        const warnings: string[] = [];
        let estimatedApiCalls = 0;

        // 생성 순서대로 계획 수립
        for (let i = 0; i < analysisResult.creationOrder.length; i++) {
          const item = analysisResult.creationOrder[i];
          const nodeInfo = analysisResult.nodes[item.id];

          if (!nodeInfo) {
            warnings.push(`Node info not found for ${item.id}`);
            continue;
          }

          const newName = nameMap?.get(item.id) || item.name;

          // 중복 검사
          if (skipExisting) {
            const existingEntity = await this.findExisting(item.type, newName, targetTemplateMap);
            if (existingEntity) {
              steps.push({
                step: i + 1,
                action: 'SKIP',
                type: item.type,
                originalId: item.id,
                originalName: item.name,
                newName,
                dependencies: nodeInfo.dependencies,
                config: nodeInfo.data,
                targetId: existingEntity.id  // target에 이미 존재하는 엔티티의 ID
              });
              this.logger.info(`SKIP: ${item.type} "${newName}" already exists in target (id: ${existingEntity.id})`);
              warnings.push(`Skipping ${item.type} "${newName}" - already exists (target id: ${existingEntity.id})`);
              continue;
            }
          }

          steps.push({
            step: i + 1,
            action: 'CREATE',
            type: item.type,
            originalId: item.id,
            originalName: item.name,
            newName,
            dependencies: nodeInfo.dependencies,
            config: nodeInfo.data
          });

          estimatedApiCalls++;
        }

        const plan: CreationPlan = {
          steps,
          warnings,
          estimatedApiCalls
        };

        this.logger.info('Plan created', {
          totalSteps: steps.length,
          createCount: steps.filter(s => s.action === 'CREATE').length,
          skipCount: steps.filter(s => s.action === 'SKIP').length,
          warnings: warnings.length
        });

        return plan;
      }
    );
  }

  /**
   * 유사 태그 검색
   */
  private async findSimilarTags(
    request: FindSimilarRequest
  ): Promise<AgentResponse<Array<{
    tag: GTMTag;
    score: number;
    reasons: string[];
  }>>> {
    return this.safeExecute(
      { action: 'findSimilar', data: request, context: this.context! },
      async () => {
        const { sourceTag, threshold = 0.5 } = request;

        // Target 엔티티 로드
        if (!this.matcher) {
          const [tags, triggers, variables] = await Promise.all([
            this.mcp!.listTags(),
            this.mcp!.listTriggers(),
            this.mcp!.listVariables()
          ]);
          this.matcher = new ReferenceMatcher(tags, triggers, variables);
        }

        // 유사 태그 검색
        const results = this.matcher.findSimilarTags(sourceTag, { threshold });

        this.logger.info('Similar tags found', {
          sourceTag: sourceTag.name,
          resultCount: results.length
        });

        return results.map(r => ({
          tag: r.entity,
          score: r.score,
          reasons: r.matchReasons
        }));
      }
    );
  }

  /**
   * 신규 태그 여부 확인
   */
  private async checkNewTag(
    request: CheckNewTagRequest
  ): Promise<AgentResponse<{
    isNew: boolean;
    existingTag?: GTMTag;
    similarTags?: Array<{ tag: GTMTag; score: number }>;
  }>> {
    return this.safeExecute(
      { action: 'checkNewTag', data: request, context: this.context! },
      async () => {
        const { tagName, eventName } = request;

        // Target 엔티티 로드
        if (!this.matcher) {
          const [tags, triggers, variables] = await Promise.all([
            this.mcp!.listTags(),
            this.mcp!.listTriggers(),
            this.mcp!.listVariables()
          ]);
          this.matcher = new ReferenceMatcher(tags, triggers, variables);
        }

        // 정확한 이름 매칭
        const existingTag = this.matcher.findTagByExactName(tagName);
        if (existingTag) {
          this.logger.info('Exact match found', { tagName });
          return {
            isNew: false,
            existingTag
          };
        }

        // 이벤트 이름으로 검색 (GA4 태그)
        if (eventName) {
          const ga4Tags = this.matcher.findGA4TagsByEventName(eventName);
          if (ga4Tags.length > 0) {
            this.logger.info('Similar GA4 tags found by event name', {
              eventName,
              count: ga4Tags.length
            });
            return {
              isNew: false,
              existingTag: ga4Tags[0],
              similarTags: ga4Tags.map(t => ({ tag: t, score: 0.8 }))
            };
          }
        }

        // 이름 유사도 검색
        const searchResults = this.matcher.searchTagsByName(tagName, {
          topK: 5,
          threshold: 30
        });

        if (searchResults.length > 0) {
          this.logger.info('Similar tags found by name', {
            tagName,
            count: searchResults.length
          });
          return {
            isNew: true,
            similarTags: searchResults.map(r => ({
              tag: r.entity,
              score: r.score / 100
            }))
          };
        }

        this.logger.info('Tag is new', { tagName });
        return { isNew: true };
      }
    );
  }

  /**
   * 엔티티 존재 여부 확인
   */
  private async checkExists(type: EntityType, name: string): Promise<boolean> {
    if (!this.matcher) return false;

    switch (type) {
      case EntityType.TAG:
        return !!this.matcher.findTagByExactName(name);
      case EntityType.TRIGGER:
        return !!this.matcher.findTriggerByExactName(name);
      case EntityType.VARIABLE:
        return !!this.matcher.findVariableByExactName(name);
      default:
        return false;
    }
  }

  /**
   * 기존 엔티티 찾기 (ID 포함)
   */
  private async findExisting(
    type: EntityType,
    name: string,
    targetTemplateMap?: Map<string, GTMTemplate>
  ): Promise<{ id: string; name: string } | null> {
    switch (type) {
      case EntityType.TAG: {
        if (!this.matcher) return null;
        const tag = this.matcher.findTagByExactName(name);
        return tag ? { id: tag.tagId, name: tag.name } : null;
      }
      case EntityType.TRIGGER: {
        if (!this.matcher) return null;
        const trigger = this.matcher.findTriggerByExactName(name);
        return trigger ? { id: trigger.triggerId, name: trigger.name } : null;
      }
      case EntityType.VARIABLE: {
        if (!this.matcher) return null;
        const variable = this.matcher.findVariableByExactName(name);
        return variable ? { id: variable.variableId, name: variable.name } : null;
      }
      case EntityType.TEMPLATE: {
        // 템플릿은 targetTemplateMap에서 직접 검색
        if (targetTemplateMap) {
          const template = targetTemplateMap.get(name);
          return template ? { id: template.templateId, name: template.name } : null;
        }
        // fallback: MCP adapter 사용
        if (this.mcp?.findTemplateByName) {
          const template = await this.mcp.findTemplateByName(name);
          return template ? { id: template.templateId, name: template.name } : null;
        }
        return null;
      }
      default:
        return null;
    }
  }
}
