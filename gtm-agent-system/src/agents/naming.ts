/**
 * Naming Agent
 * 명명 패턴 분석 및 새 이름 생성
 */

import {
  NamingParser,
  NamingPattern,
  GTMTag,
  GTMTrigger,
  GTMVariable,
  EntityType,
  GTM_NAMING_TEMPLATES
} from 'gtm-agent-skills';
import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../types/agent';

// ==================== Request/Response Types ====================

export interface ExtractPatternRequest {
  names: string[];
  entityType?: EntityType;
}

export interface GenerateNamesRequest {
  sourceEntities: {
    tags: GTMTag[];
    triggers: GTMTrigger[];
    variables: GTMVariable[];
  };
  targetPattern?: NamingPattern;
  namePrefix?: string;
  nameSuffix?: string;
}

export interface NamingResult {
  pattern?: NamingPattern;
  nameMap: Map<string, string>; // originalId -> newName
}

// ==================== Naming Agent ====================

export class NamingAgent extends BaseAgent {
  private parser: NamingParser;

  constructor() {
    super('naming');
    this.parser = new NamingParser();
  }

  /**
   * 요청 처리
   */
  async execute<T, R>(request: AgentRequest<T>): Promise<AgentResponse<R>> {
    switch (request.action) {
      case 'extractPattern':
        return this.extractPattern(request.data as ExtractPatternRequest) as Promise<AgentResponse<R>>;

      case 'generateNames':
        return this.generateNames(request.data as GenerateNamesRequest) as Promise<AgentResponse<R>>;

      case 'analyzePatterns':
        return this.analyzePatterns(request.data as { tags: GTMTag[]; triggers: GTMTrigger[]; variables: GTMVariable[] }) as Promise<AgentResponse<R>>;

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  /**
   * 이름 목록에서 패턴 추출
   */
  private async extractPattern(
    request: ExtractPatternRequest
  ): Promise<AgentResponse<NamingPattern | null>> {
    return this.safeExecute(
      { action: 'extractPattern', data: request, context: this.context! },
      async () => {
        this.logger.info('Extracting pattern', { count: request.names.length });

        const pattern = this.parser.extractPattern(request.names);

        if (pattern) {
          this.logger.info('Pattern extracted', {
            separator: pattern.separator,
            segments: pattern.segments.length,
            confidence: pattern.confidence
          });
        } else {
          this.logger.warn('No pattern found');
        }

        return pattern;
      }
    );
  }

  /**
   * 새 이름 생성
   */
  private async generateNames(
    request: GenerateNamesRequest
  ): Promise<AgentResponse<NamingResult>> {
    return this.safeExecute(
      { action: 'generateNames', data: request, context: this.context! },
      async () => {
        const { sourceEntities, targetPattern, namePrefix, nameSuffix } = request;
        const nameMap = new Map<string, string>();

        // 태그 이름 생성
        for (const tag of sourceEntities.tags) {
          const newName = this.generateEntityName(
            tag.name,
            targetPattern,
            namePrefix,
            nameSuffix
          );
          nameMap.set(tag.tagId, newName);
        }

        // 트리거 이름 생성
        for (const trigger of sourceEntities.triggers) {
          const newName = this.generateEntityName(
            trigger.name,
            targetPattern,
            namePrefix,
            nameSuffix
          );
          nameMap.set(trigger.triggerId, newName);
        }

        // 변수 이름 생성 (변수는 이름 기반 참조이므로 보통 유지)
        for (const variable of sourceEntities.variables) {
          const newName = this.generateEntityName(
            variable.name,
            targetPattern,
            namePrefix,
            nameSuffix
          );
          nameMap.set(variable.variableId, newName);
        }

        this.logger.info('Names generated', { count: nameMap.size });

        return {
          pattern: targetPattern,
          nameMap
        };
      }
    );
  }

  /**
   * 전체 패턴 분석
   */
  private async analyzePatterns(
    entities: { tags: GTMTag[]; triggers: GTMTrigger[]; variables: GTMVariable[] }
  ): Promise<AgentResponse<{
    tagPatterns: Map<string, NamingPattern>;
    triggerPatterns: Map<string, NamingPattern>;
    variablePatterns: Map<string, NamingPattern>;
  }>> {
    return this.safeExecute(
      { action: 'analyzePatterns', data: entities, context: this.context! },
      async () => {
        this.logger.info('Analyzing patterns for all entity types');

        // 태그 패턴 분석
        const tagNames = entities.tags.map(t => t.name);
        const tagPatterns = this.parser.extractPatternsByPrefix(tagNames, [
          'GA4', 'UA', 'FB', 'AD', 'HTML', 'cHTML'
        ]);

        // 트리거 패턴 분석
        const triggerNames = entities.triggers.map(t => t.name);
        const triggerPatterns = this.parser.extractPatternsByPrefix(triggerNames, [
          'CE', 'EV', 'Click', 'CL', 'Scroll', 'Timer'
        ]);

        // 변수 패턴 분석
        const variableNames = entities.variables.map(v => v.name);
        const variablePatterns = this.parser.extractPatternsByPrefix(variableNames, [
          'DLV', 'DL', 'JS', 'jsVar', 'Const', 'Lookup', 'Cookie'
        ]);

        this.logger.info('Pattern analysis completed', {
          tagPatterns: tagPatterns.size,
          triggerPatterns: triggerPatterns.size,
          variablePatterns: variablePatterns.size
        });

        return {
          tagPatterns,
          triggerPatterns,
          variablePatterns
        };
      }
    );
  }

  /**
   * 엔티티 이름 생성
   */
  private generateEntityName(
    originalName: string,
    pattern?: NamingPattern,
    prefix?: string,
    suffix?: string
  ): string {
    // 패턴이 있으면 패턴 기반 변환
    if (pattern) {
      const variables = this.parser.extractVariables(originalName, pattern);
      if (variables) {
        return this.parser.generateName(pattern, variables);
      }
    }

    // 단순 prefix/suffix 적용
    let newName = originalName;
    if (prefix) newName = `${prefix}${newName}`;
    if (suffix) newName = `${newName}${suffix}`;

    return newName;
  }

  /**
   * 표준 템플릿 반환
   */
  getStandardTemplates(): typeof GTM_NAMING_TEMPLATES {
    return GTM_NAMING_TEMPLATES;
  }
}
