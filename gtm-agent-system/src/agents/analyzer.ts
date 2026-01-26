/**
 * Analyzer Agent
 * Source 워크스페이스 분석 및 의존성 그래프 생성
 */

import {
  DependencyGraphBuilder,
  AnalysisResult,
  GTMTag,
  GTMTrigger,
  GTMVariable,
  GTMTemplate
} from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';
import { AnalysisError } from '../utils/error';

// ==================== Request/Response Types ====================

export interface AnalyzeTagsRequest {
  tagIds: string[];
  includeAllDependencies?: boolean;
}

export interface AnalyzeWorkspaceRequest {
  tagFilter?: {
    types?: string[];
    namePattern?: string;
    limit?: number;
  };
}

export interface AnalysisData {
  analysisResult: AnalysisResult;
  sourceEntities: {
    tags: GTMTag[];
    triggers: GTMTrigger[];
    variables: GTMVariable[];
    templates: GTMTemplate[];
  };
}

// ==================== Analyzer Agent ====================

export class AnalyzerAgent extends BaseAgent {
  constructor() {
    super('analyzer');
  }

  /**
   * 요청 처리
   */
  async execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>> {
    this.validateContext();

    switch (request.action) {
      case 'analyzeTags':
        return this.analyzeTags(request.data as AnalyzeTagsRequest) as Promise<AgentResponse<R>>;

      case 'analyzeWorkspace':
        return this.analyzeWorkspace(request.data as AnalyzeWorkspaceRequest) as Promise<AgentResponse<R>>;

      case 'listEntities':
        return this.listAllEntities() as Promise<AgentResponse<R>>;

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  /**
   * 특정 태그들 분석
   */
  private async analyzeTags(
    request: AnalyzeTagsRequest
  ): Promise<AgentResponse<AnalysisData>> {
    return this.safeExecute(
      { action: 'analyzeTags', data: request, context: this.context! },
      async () => {
        this.logger.info('Analyzing tags', { tagIds: request.tagIds });

        // 1. 모든 엔티티 조회 (templates 포함)
        const [tags, triggers, variables, templates] = await Promise.all([
          this.mcp!.listTags(),
          this.mcp!.listTriggers(),
          this.mcp!.listVariables(),
          this.mcp!.listTemplates()
        ]);

        this.logger.info('Fetched entities', {
          tags: tags.length,
          triggers: triggers.length,
          variables: variables.length,
          templates: templates.length
        });

        // 2. 요청된 태그 필터링
        const targetTags = request.tagIds.length > 0
          ? tags.filter(t => request.tagIds.includes(t.tagId))
          : tags;

        if (targetTags.length === 0) {
          throw new AnalysisError('No tags found for the given IDs');
        }

        // 3. 의존성 그래프 구축 (역추적 포함, 템플릿 포함)
        const builder = new DependencyGraphBuilder(this.mcp!);
        const graph = builder.buildFromEntities(
          targetTags,
          triggers,
          variables,
          {
            enableReverseTracking: request.includeAllDependencies ?? true,
            allWorkspaceTags: tags  // 역추적용 전체 태그 전달
          },
          templates  // 템플릿 목록 전달
        );

        // 4. 분석 결과 생성
        const analysisResult = builder.toAnalysisResult(graph);

        this.logger.info('Analysis completed', {
          total: analysisResult.summary.total,
          templates: analysisResult.summary.templates,
          creationOrder: analysisResult.creationOrder.length
        });

        return {
          analysisResult,
          sourceEntities: { tags: targetTags, triggers, variables, templates }
        };
      }
    );
  }

  /**
   * 전체 워크스페이스 분석
   */
  private async analyzeWorkspace(
    request: AnalyzeWorkspaceRequest
  ): Promise<AgentResponse<AnalysisData>> {
    return this.safeExecute(
      { action: 'analyzeWorkspace', data: request, context: this.context! },
      async () => {
        this.logger.info('Analyzing workspace');

        // 1. 모든 엔티티 조회 (templates 포함)
        const [tags, triggers, variables, templates] = await Promise.all([
          this.mcp!.listTags(),
          this.mcp!.listTriggers(),
          this.mcp!.listVariables(),
          this.mcp!.listTemplates()
        ]);

        this.reportProgress(1, 3, 'Entities fetched');

        // 2. 필터링
        let filteredTags = tags;
        if (request.tagFilter) {
          if (request.tagFilter.types) {
            filteredTags = filteredTags.filter(t =>
              request.tagFilter!.types!.includes(t.type)
            );
          }
          if (request.tagFilter.namePattern) {
            const pattern = new RegExp(request.tagFilter.namePattern, 'i');
            filteredTags = filteredTags.filter(t => pattern.test(t.name));
          }
          if (request.tagFilter.limit) {
            filteredTags = filteredTags.slice(0, request.tagFilter.limit);
          }
        }

        this.reportProgress(2, 3, 'Tags filtered');

        // 3. 의존성 그래프 구축 (역추적 포함, 템플릿 포함)
        const builder = new DependencyGraphBuilder(this.mcp!);
        const graph = builder.buildFromEntities(
          filteredTags,
          triggers,
          variables,
          {
            enableReverseTracking: true,
            allWorkspaceTags: tags  // 역추적용 전체 태그 전달
          },
          templates  // 템플릿 목록 전달
        );
        const analysisResult = builder.toAnalysisResult(graph);

        this.reportProgress(3, 3, 'Analysis completed');

        return {
          analysisResult,
          sourceEntities: { tags: filteredTags, triggers, variables, templates }
        };
      }
    );
  }

  /**
   * 모든 엔티티 목록 조회
   */
  private async listAllEntities(): Promise<AgentResponse<{
    tags: GTMTag[];
    triggers: GTMTrigger[];
    variables: GTMVariable[];
    templates: GTMTemplate[];
  }>> {
    return this.safeExecute(
      { action: 'listEntities', data: {}, context: this.context! },
      async () => {
        const [tags, triggers, variables, templates] = await Promise.all([
          this.mcp!.listTags(),
          this.mcp!.listTriggers(),
          this.mcp!.listVariables(),
          this.mcp!.listTemplates()
        ]);

        return { tags, triggers, variables, templates };
      }
    );
  }
}
