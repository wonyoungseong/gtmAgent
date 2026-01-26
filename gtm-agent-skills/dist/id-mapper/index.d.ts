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
import { EntityType } from '../types/gtm';
import { IdMapping, IdMappingEntry } from '../types/dependency';
export declare class IdMapper {
    private mapping;
    private reverseMapping;
    private nameMapping;
    private templateTypeMapping;
    private lock;
    private static readonly LOCK_KEY;
    /**
     * 매핑 추가 (동기, 순차 실행 시 사용)
     */
    add(originalId: string, newId: string, type: EntityType, name: string): void;
    /**
     * 매핑 추가 (비동기, 병렬 실행 시 사용 - Thread-safe)
     * Use this method when adding mappings from parallel operations to prevent race conditions.
     */
    addSafe(originalId: string, newId: string, type: EntityType, name: string): Promise<void>;
    /**
     * 원본 ID로 새 ID 조회
     */
    getNewId(originalId: string): string | undefined;
    /**
     * 이름으로 새 ID 조회
     */
    getNewIdByName(name: string): string | undefined;
    /**
     * 새 ID로 원본 ID 조회
     */
    getOriginalId(newId: string): string | undefined;
    /**
     * 원본 ID로 전체 매핑 정보 조회
     */
    getMapping(originalId: string): IdMappingEntry | undefined;
    /**
     * 매핑 존재 여부 확인
     */
    has(originalId: string): boolean;
    /**
     * 이름으로 매핑 존재 여부 확인
     */
    hasByName(name: string): boolean;
    /**
     * 커스텀 템플릿 type 매핑 추가 (cvt_old → cvt_new)
     */
    addTemplateTypeMapping(originalCvtType: string, newCvtType: string): void;
    /**
     * 커스텀 템플릿 type 매핑 조회
     */
    getNewTemplateType(originalCvtType: string): string | undefined;
    /**
     * 전체 매핑 반환
     */
    getAll(): IdMapping;
    /**
     * 매핑 개수
     */
    get size(): number;
    /**
     * 타입별 매핑 필터링
     */
    filterByType(type: EntityType): IdMapping;
    /**
     * 텍스트 내 ID 참조 변환
     * (firingTriggerId, configTagId 등 직접 ID 참조만 변환)
     */
    transformIdReferences(text: string): string;
    /**
     * 배열 내 ID 변환
     */
    transformIdArray(ids: string[]): string[];
    /**
     * 객체 내 특정 필드들의 ID 변환
     */
    transformObject<T extends object>(obj: T, idFields: string[]): T;
    /**
     * 매핑 초기화
     */
    clear(): void;
    /**
     * JSON으로 직렬화
     */
    toJSON(): string;
    /**
     * JSON에서 복원
     */
    static fromJSON(json: string): IdMapper;
    /**
     * 로그용 문자열
     */
    toLogString(): string;
    /**
     * 정규식 이스케이프
     */
    private escapeRegex;
}
export declare function getSessionMapper(sessionId: string): IdMapper;
export declare function clearSessionMapper(sessionId: string): void;
export declare function clearAllSessionMappers(): void;
