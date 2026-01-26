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
import { GTMTag, GTMTrigger, GTMVariable, GTMTemplate } from '../types/gtm';
import { IdMapper } from '../id-mapper';
export interface TransformOptions {
    newName?: string;
    namePrefix?: string;
    nameSuffix?: string;
    preserveNotes?: boolean;
}
export declare class ConfigTransformer {
    private idMapper;
    constructor(idMapper: IdMapper);
    /**
     * 태그 Config 변환
     */
    transformTag(source: GTMTag, options?: TransformOptions): Partial<GTMTag>;
    /**
     * 트리거 Config 변환
     */
    transformTrigger(source: GTMTrigger, options?: TransformOptions): Partial<GTMTrigger>;
    /**
     * 변수 Config 변환
     */
    transformVariable(source: GTMVariable, options?: TransformOptions): Partial<GTMVariable>;
    /**
     * 태그 Parameters 변환 (configTagId 등 ID 참조 포함)
     */
    private transformTagParameters;
    /**
     * Parameters 변환 (일반)
     */
    private transformParameters;
    /**
     * 단일 Parameter 변환
     */
    private transformParameter;
    /**
     * 이름 결정
     */
    private resolveName;
}
/**
 * 엔티티에서 생성용 Config 추출 (메타데이터 제거)
 */
export declare function extractCreateConfig<T extends GTMTag | GTMTrigger | GTMVariable | GTMTemplate>(entity: T): Partial<T>;
/**
 * 두 Config 비교 (변경 사항 확인용)
 */
export declare function compareConfigs(source: Partial<GTMTag | GTMTrigger | GTMVariable>, target: Partial<GTMTag | GTMTrigger | GTMVariable>): {
    identical: boolean;
    differences: Array<{
        field: string;
        source: any;
        target: any;
    }>;
};
