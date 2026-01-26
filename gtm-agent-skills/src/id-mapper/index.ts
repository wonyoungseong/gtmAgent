/**
 * ID Mapper Skill
 *
 * Source 워크스페이스의 ID를 Target 워크스페이스의 ID로 매핑 관리
 *
 * @example
 * ```typescript
 * const mapper = new IdMapper();
 *
 * // 변수 생성 후 매핑 등록
 * mapper.add('source-var-123', 'target-var-456', EntityType.VARIABLE, 'DLV - user_id');
 *
 * // 다음 엔티티 생성 시 참조 변환
 * const newTriggerId = mapper.getNewId('source-trigger-789');
 *
 * // 텍스트 내 ID 참조 일괄 변환
 * const transformedConfig = mapper.transformIdReferences(configJson);
 * ```
 */

import AsyncLock from 'async-lock';
import { EntityType } from '../types/gtm';
import { IdMapping, IdMappingEntry } from '../types/dependency';

export class IdMapper {
  private mapping: IdMapping = {};
  private reverseMapping: Map<string, string> = new Map();
  private nameMapping: Map<string, string> = new Map(); // 이름 → 새 ID
  private templateTypeMapping: Map<string, string> = new Map(); // cvt_old → cvt_new
  private lock: AsyncLock = new AsyncLock();
  private static readonly LOCK_KEY = 'id-mapper';

  /**
   * 매핑 추가 (동기, 순차 실행 시 사용)
   */
  add(originalId: string, newId: string, type: EntityType, name: string): void {
    this.mapping[originalId] = { newId, type, name };
    this.reverseMapping.set(newId, originalId);
    this.nameMapping.set(name, newId);
  }

  /**
   * 매핑 추가 (비동기, 병렬 실행 시 사용 - Thread-safe)
   * Use this method when adding mappings from parallel operations to prevent race conditions.
   */
  async addSafe(originalId: string, newId: string, type: EntityType, name: string): Promise<void> {
    await this.lock.acquire(IdMapper.LOCK_KEY, () => {
      this.mapping[originalId] = { newId, type, name };
      this.reverseMapping.set(newId, originalId);
      this.nameMapping.set(name, newId);
    });
  }

  /**
   * 원본 ID로 새 ID 조회
   */
  getNewId(originalId: string): string | undefined {
    // name: 접두사 처리
    if (originalId.startsWith('name:')) {
      const name = originalId.substring(5);
      return this.nameMapping.get(name);
    }
    return this.mapping[originalId]?.newId;
  }

  /**
   * 이름으로 새 ID 조회
   */
  getNewIdByName(name: string): string | undefined {
    return this.nameMapping.get(name);
  }

  /**
   * 새 ID로 원본 ID 조회
   */
  getOriginalId(newId: string): string | undefined {
    return this.reverseMapping.get(newId);
  }

  /**
   * 원본 ID로 전체 매핑 정보 조회
   */
  getMapping(originalId: string): IdMappingEntry | undefined {
    return this.mapping[originalId];
  }

  /**
   * 매핑 존재 여부 확인
   */
  has(originalId: string): boolean {
    if (originalId.startsWith('name:')) {
      const name = originalId.substring(5);
      return this.nameMapping.has(name);
    }
    return originalId in this.mapping;
  }

  /**
   * 이름으로 매핑 존재 여부 확인
   */
  hasByName(name: string): boolean {
    return this.nameMapping.has(name);
  }

  /**
   * 커스텀 템플릿 type 매핑 추가 (cvt_old → cvt_new)
   */
  addTemplateTypeMapping(originalCvtType: string, newCvtType: string): void {
    this.templateTypeMapping.set(originalCvtType, newCvtType);
  }

  /**
   * 커스텀 템플릿 type 매핑 조회
   */
  getNewTemplateType(originalCvtType: string): string | undefined {
    return this.templateTypeMapping.get(originalCvtType);
  }

  /**
   * 전체 매핑 반환
   */
  getAll(): IdMapping {
    return { ...this.mapping };
  }

  /**
   * 매핑 개수
   */
  get size(): number {
    return Object.keys(this.mapping).length;
  }

  /**
   * 타입별 매핑 필터링
   */
  filterByType(type: EntityType): IdMapping {
    const filtered: IdMapping = {};

    for (const [id, value] of Object.entries(this.mapping)) {
      if (value.type === type) {
        filtered[id] = value;
      }
    }

    return filtered;
  }

  /**
   * 텍스트 내 ID 참조 변환
   * (firingTriggerId, configTagId 등 직접 ID 참조만 변환)
   */
  transformIdReferences(text: string): string {
    let result = text;

    for (const [originalId, { newId }] of Object.entries(this.mapping)) {
      // name: 접두사는 스킵
      if (originalId.startsWith('name:')) continue;

      // 직접 ID 참조 변환
      const idPattern = new RegExp(`\\b${this.escapeRegex(originalId)}\\b`, 'g');
      result = result.replace(idPattern, newId);
    }

    return result;
  }

  /**
   * 배열 내 ID 변환
   */
  transformIdArray(ids: string[]): string[] {
    return ids.map(id => this.getNewId(id) || id);
  }

  /**
   * 객체 내 특정 필드들의 ID 변환
   */
  transformObject<T extends object>(
    obj: T,
    idFields: string[]
  ): T {
    const result = { ...obj } as any;

    for (const field of idFields) {
      if (field in result && result[field]) {
        if (Array.isArray(result[field])) {
          result[field] = this.transformIdArray(result[field]);
        } else if (typeof result[field] === 'string') {
          const newId = this.getNewId(result[field]);
          if (newId) {
            result[field] = newId;
          }
        }
      }
    }

    return result;
  }

  /**
   * 매핑 초기화
   */
  clear(): void {
    this.mapping = {};
    this.reverseMapping.clear();
    this.nameMapping.clear();
    this.templateTypeMapping.clear();
  }

  /**
   * JSON으로 직렬화
   */
  toJSON(): string {
    return JSON.stringify(this.mapping, null, 2);
  }

  /**
   * JSON에서 복원
   */
  static fromJSON(json: string): IdMapper {
    const mapper = new IdMapper();
    const data = JSON.parse(json) as IdMapping;

    for (const [originalId, entry] of Object.entries(data)) {
      mapper.add(originalId, entry.newId, entry.type, entry.name);
    }

    return mapper;
  }

  /**
   * 로그용 문자열
   */
  toLogString(): string {
    const lines: string[] = ['ID Mapping:'];

    const byType = new Map<EntityType, Array<{ orig: string; new: string; name: string }>>();

    for (const [originalId, { newId, type, name }] of Object.entries(this.mapping)) {
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push({ orig: originalId, new: newId, name });
    }

    for (const [type, entries] of byType) {
      lines.push(`\n  [${type.toUpperCase()}]`);
      for (const { orig, new: newId, name } of entries) {
        lines.push(`    "${name}": ${orig} -> ${newId}`);
      }
    }

    if (this.templateTypeMapping.size > 0) {
      lines.push(`\n  [TEMPLATE TYPE MAPPING]`);
      for (const [oldType, newType] of this.templateTypeMapping) {
        lines.push(`    ${oldType} -> ${newType}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 정규식 이스케이프
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// 싱글톤 팩토리 (워크플로우 세션용)
const sessionMappers = new Map<string, IdMapper>();

export function getSessionMapper(sessionId: string): IdMapper {
  if (!sessionMappers.has(sessionId)) {
    sessionMappers.set(sessionId, new IdMapper());
  }
  return sessionMappers.get(sessionId)!;
}

export function clearSessionMapper(sessionId: string): void {
  sessionMappers.delete(sessionId);
}

export function clearAllSessionMappers(): void {
  sessionMappers.clear();
}
