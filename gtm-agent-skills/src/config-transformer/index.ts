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

import {
  GTMTag,
  GTMTrigger,
  GTMVariable,
  GTMTemplate,
  GTMParameter
} from '../types/gtm';
import { IdMapper } from '../id-mapper';

export interface TransformOptions {
  newName?: string;
  namePrefix?: string;
  nameSuffix?: string;
  preserveNotes?: boolean;
}

export class ConfigTransformer {
  constructor(private idMapper: IdMapper) {}

  /**
   * 태그 Config 변환
   */
  transformTag(
    source: GTMTag,
    options: TransformOptions = {}
  ): Partial<GTMTag> {
    const newName = this.resolveName(source.name, options);

    // cvt_ type remapping: 커스텀 템플릿의 type을 target container용으로 변환
    let tagType = source.type;
    if (tagType?.startsWith('cvt_')) {
      const remappedType = this.idMapper.getNewTemplateType(tagType);
      if (remappedType) {
        tagType = remappedType;
      }
    }

    const config: Partial<GTMTag> = {
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
  transformTrigger(
    source: GTMTrigger,
    options: TransformOptions = {}
  ): Partial<GTMTrigger> {
    const newName = this.resolveName(source.name, options);

    const config: Partial<GTMTrigger> = {
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
  transformVariable(
    source: GTMVariable,
    options: TransformOptions = {}
  ): Partial<GTMVariable> {
    const newName = this.resolveName(source.name, options);

    const config: Partial<GTMVariable> = {
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
  private transformTagParameters(parameters: GTMParameter[]): GTMParameter[] {
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
  private transformParameters(parameters: GTMParameter[]): GTMParameter[] {
    return parameters.map(param => this.transformParameter(param));
  }

  /**
   * 단일 Parameter 변환
   */
  private transformParameter(param: GTMParameter): GTMParameter {
    const newParam: GTMParameter = {
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
  private resolveName(originalName: string, options: TransformOptions): string {
    if (options.newName) {
      return options.newName;
    }

    const prefix = options.namePrefix || '';
    const suffix = options.nameSuffix || '';

    return `${prefix}${originalName}${suffix}`;
  }
}

// ==================== Utility Functions ====================

/**
 * 엔티티에서 생성용 Config 추출 (메타데이터 제거)
 */
export function extractCreateConfig<T extends GTMTag | GTMTrigger | GTMVariable | GTMTemplate>(
  entity: T
): Partial<T> {
  const config = { ...entity } as any;

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
export function compareConfigs(
  source: Partial<GTMTag | GTMTrigger | GTMVariable>,
  target: Partial<GTMTag | GTMTrigger | GTMVariable>
): {
  identical: boolean;
  differences: Array<{ field: string; source: any; target: any }>;
} {
  const differences: Array<{ field: string; source: any; target: any }> = [];

  const allKeys = new Set([
    ...Object.keys(source),
    ...Object.keys(target)
  ]);

  for (const key of allKeys) {
    const sourceVal = (source as any)[key];
    const targetVal = (target as any)[key];

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
