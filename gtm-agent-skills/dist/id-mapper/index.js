"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdMapper = void 0;
exports.getSessionMapper = getSessionMapper;
exports.clearSessionMapper = clearSessionMapper;
exports.clearAllSessionMappers = clearAllSessionMappers;
const async_lock_1 = __importDefault(require("async-lock"));
class IdMapper {
    constructor() {
        this.mapping = {};
        this.reverseMapping = new Map();
        this.nameMapping = new Map(); // 이름 → 새 ID
        this.templateTypeMapping = new Map(); // cvt_old → cvt_new
        this.lock = new async_lock_1.default();
    }
    /**
     * 매핑 추가 (동기, 순차 실행 시 사용)
     */
    add(originalId, newId, type, name) {
        this.mapping[originalId] = { newId, type, name };
        this.reverseMapping.set(newId, originalId);
        this.nameMapping.set(name, newId);
    }
    /**
     * 매핑 추가 (비동기, 병렬 실행 시 사용 - Thread-safe)
     * Use this method when adding mappings from parallel operations to prevent race conditions.
     */
    async addSafe(originalId, newId, type, name) {
        await this.lock.acquire(IdMapper.LOCK_KEY, () => {
            this.mapping[originalId] = { newId, type, name };
            this.reverseMapping.set(newId, originalId);
            this.nameMapping.set(name, newId);
        });
    }
    /**
     * 원본 ID로 새 ID 조회
     */
    getNewId(originalId) {
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
    getNewIdByName(name) {
        return this.nameMapping.get(name);
    }
    /**
     * 새 ID로 원본 ID 조회
     */
    getOriginalId(newId) {
        return this.reverseMapping.get(newId);
    }
    /**
     * 원본 ID로 전체 매핑 정보 조회
     */
    getMapping(originalId) {
        return this.mapping[originalId];
    }
    /**
     * 매핑 존재 여부 확인
     */
    has(originalId) {
        if (originalId.startsWith('name:')) {
            const name = originalId.substring(5);
            return this.nameMapping.has(name);
        }
        return originalId in this.mapping;
    }
    /**
     * 이름으로 매핑 존재 여부 확인
     */
    hasByName(name) {
        return this.nameMapping.has(name);
    }
    /**
     * 커스텀 템플릿 type 매핑 추가 (cvt_old → cvt_new)
     */
    addTemplateTypeMapping(originalCvtType, newCvtType) {
        this.templateTypeMapping.set(originalCvtType, newCvtType);
    }
    /**
     * 커스텀 템플릿 type 매핑 조회
     */
    getNewTemplateType(originalCvtType) {
        return this.templateTypeMapping.get(originalCvtType);
    }
    /**
     * 전체 매핑 반환
     */
    getAll() {
        return { ...this.mapping };
    }
    /**
     * 매핑 개수
     */
    get size() {
        return Object.keys(this.mapping).length;
    }
    /**
     * 타입별 매핑 필터링
     */
    filterByType(type) {
        const filtered = {};
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
    transformIdReferences(text) {
        let result = text;
        for (const [originalId, { newId }] of Object.entries(this.mapping)) {
            // name: 접두사는 스킵
            if (originalId.startsWith('name:'))
                continue;
            // 직접 ID 참조 변환
            const idPattern = new RegExp(`\\b${this.escapeRegex(originalId)}\\b`, 'g');
            result = result.replace(idPattern, newId);
        }
        return result;
    }
    /**
     * 배열 내 ID 변환
     */
    transformIdArray(ids) {
        return ids.map(id => this.getNewId(id) || id);
    }
    /**
     * 객체 내 특정 필드들의 ID 변환
     */
    transformObject(obj, idFields) {
        const result = { ...obj };
        for (const field of idFields) {
            if (field in result && result[field]) {
                if (Array.isArray(result[field])) {
                    result[field] = this.transformIdArray(result[field]);
                }
                else if (typeof result[field] === 'string') {
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
    clear() {
        this.mapping = {};
        this.reverseMapping.clear();
        this.nameMapping.clear();
        this.templateTypeMapping.clear();
    }
    /**
     * JSON으로 직렬화
     */
    toJSON() {
        return JSON.stringify(this.mapping, null, 2);
    }
    /**
     * JSON에서 복원
     */
    static fromJSON(json) {
        const mapper = new IdMapper();
        const data = JSON.parse(json);
        for (const [originalId, entry] of Object.entries(data)) {
            mapper.add(originalId, entry.newId, entry.type, entry.name);
        }
        return mapper;
    }
    /**
     * 로그용 문자열
     */
    toLogString() {
        const lines = ['ID Mapping:'];
        const byType = new Map();
        for (const [originalId, { newId, type, name }] of Object.entries(this.mapping)) {
            if (!byType.has(type)) {
                byType.set(type, []);
            }
            byType.get(type).push({ orig: originalId, new: newId, name });
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
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
exports.IdMapper = IdMapper;
IdMapper.LOCK_KEY = 'id-mapper';
// 싱글톤 팩토리 (워크플로우 세션용)
const sessionMappers = new Map();
function getSessionMapper(sessionId) {
    if (!sessionMappers.has(sessionId)) {
        sessionMappers.set(sessionId, new IdMapper());
    }
    return sessionMappers.get(sessionId);
}
function clearSessionMapper(sessionId) {
    sessionMappers.delete(sessionId);
}
function clearAllSessionMappers() {
    sessionMappers.clear();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaWQtbWFwcGVyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBa0JHOzs7Ozs7QUE4UEgsNENBS0M7QUFFRCxnREFFQztBQUVELHdEQUVDO0FBelFELDREQUFtQztBQUluQyxNQUFhLFFBQVE7SUFBckI7UUFDVSxZQUFPLEdBQWMsRUFBRSxDQUFDO1FBQ3hCLG1CQUFjLEdBQXdCLElBQUksR0FBRyxFQUFFLENBQUM7UUFDaEQsZ0JBQVcsR0FBd0IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLFlBQVk7UUFDMUQsd0JBQW1CLEdBQXdCLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQyxvQkFBb0I7UUFDMUUsU0FBSSxHQUFjLElBQUksb0JBQVMsRUFBRSxDQUFDO0lBOE81QyxDQUFDO0lBM09DOztPQUVHO0lBQ0gsR0FBRyxDQUFDLFVBQWtCLEVBQUUsS0FBYSxFQUFFLElBQWdCLEVBQUUsSUFBWTtRQUNuRSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUNqRCxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQWtCLEVBQUUsS0FBYSxFQUFFLElBQWdCLEVBQUUsSUFBWTtRQUM3RSxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO1lBQzlDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxLQUFL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LENBQUMsRUFBRSxDQUFDO1lBQ3RDLEtBQUssQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsQ0FBQztZQUMxQyxLQUFLLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7Z0JBQzFELEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxPQUFPLE9BQU8sT0FBTyxFQUFFLENBQUMsQ0FBQztZQUM3QyxDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxXQUFXLENBQUMsR0FBVztRQUM3QixPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDcEQsQ0FBQzs7QUFsUEgsNEJBbVBDO0FBN095QixpQkFBUSxHQUFHLFdBQVcsQUFBZCxDQUFlO0FBK09qRCxzQkFBc0I7QUFDdEIsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQW9CLENBQUM7QUFFbkQsU0FBZ0IsZ0JBQWdCLENBQUMsU0FBaUI7SUFDaEQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztRQUNuQyxjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxJQUFJLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUNELE9BQU8sY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUUsQ0FBQztBQUN4QyxDQUFDO0FBRUQsU0FBZ0Isa0JBQWtCLENBQUMsU0FBaUI7SUFDbEQsY0FBYyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNuQyxDQUFDO0FBRUQsU0FBZ0Isc0JBQXNCO0lBQ3BDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztBQUN6QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIElEIE1hcHBlciBTa2lsbFxyXG4gKlxyXG4gKiBTb3VyY2Ug7JuM7YGs7Iqk7Y6Y7J207Iqk7J2YIElE66W8IFRhcmdldCDsm4ztgazsiqTtjpjsnbTsiqTsnZggSUTroZwg66ek7ZWRIOq0gOumrFxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGB0eXBlc2NyaXB0XHJcbiAqIGNvbnN0IG1hcHBlciA9IG5ldyBJZE1hcHBlcigpO1xyXG4gKlxyXG4gKiAvLyDrs4DsiJgg7IOd7ISxIO2bhCDrp6TtlZEg65Ox66GdXHJcbiAqIG1hcHBlci5hZGQoJ3NvdXJjZS12YXItMTIzJywgJ3RhcmdldC12YXItNDU2JywgRW50aXR5VHlwZS5WQVJJQUJMRSwgJ0RMViAtIHVzZXJfaWQnKTtcclxuICpcclxuICogLy8g64uk7J2MIOyXlO2LsO2LsCDsg53shLEg7IucIOywuOyhsCDrs4DtmZhcclxuICogY29uc3QgbmV3VHJpZ2dlcklkID0gbWFwcGVyLmdldE5ld0lkKCdzb3VyY2UtdHJpZ2dlci03ODknKTtcclxuICpcclxuICogLy8g7YWN7Iqk7Yq4IOuCtCBJRCDssLjsobAg7J286rSEIOuzgO2ZmFxyXG4gKiBjb25zdCB0cmFuc2Zvcm1lZENvbmZpZyA9IG1hcHBlci50cmFuc2Zvcm1JZFJlZmVyZW5jZXMoY29uZmlnSnNvbik7XHJcbiAqIGBgYFxyXG4gKi9cclxuXHJcbmltcG9ydCBBc3luY0xvY2sgZnJvbSAnYXN5bmMtbG9jayc7XHJcbmltcG9ydCB7IEVudGl0eVR5cGUgfSBmcm9tICcuLi90eXBlcy9ndG0nO1xyXG5pbXBvcnQgeyBJZE1hcHBpbmcsIElkTWFwcGluZ0VudHJ5IH0gZnJvbSAnLi4vdHlwZXMvZGVwZW5kZW5jeSc7XHJcblxyXG5leHBvcnQgY2xhc3MgSWRNYXBwZXIge1xyXG4gIHByaXZhdGUgbWFwcGluZzogSWRNYXBwaW5nID0ge307XHJcbiAgcHJpdmF0ZSByZXZlcnNlTWFwcGluZzogTWFwPHN0cmluZywgc3RyaW5nPiA9IG5ldyBNYXAoKTtcclxuICBwcml2YXRlIG5hbWVNYXBwaW5nOiBNYXA8c3RyaW5nLCBzdHJpbmc+ID0gbmV3IE1hcCgpOyAvLyDsnbTrpoQg4oaSIOyDiCBJRFxyXG4gIHByaXZhdGUgdGVtcGxhdGVUeXBlTWFwcGluZzogTWFwPHN0cmluZywgc3RyaW5nPiA9IG5ldyBNYXAoKTsgLy8gY3Z0X29sZCDihpIgY3Z0X25ld1xyXG4gIHByaXZhdGUgbG9jazogQXN5bmNMb2NrID0gbmV3IEFzeW5jTG9jaygpO1xyXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IExPQ0tfS0VZID0gJ2lkLW1hcHBlcic7XHJcblxyXG4gIC8qKlxyXG4gICAqIOunpO2VkSDstpTqsIAgKOuPmeq4sCwg7Iic7LCoIOyLpO2WiSDsi5wg7IKs7JqpKVxyXG4gICAqL1xyXG4gIGFkZChvcmlnaW5hbElkOiBzdHJpbmcsIG5ld0lkOiBzdHJpbmcsIHR5cGU6IEVudGl0eVR5cGUsIG5hbWU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5tYXBwaW5nW29yaWdpbmFsSWRdID0geyBuZXdJZCwgdHlwZSwgbmFtZSB9O1xyXG4gICAgdGhpcy5yZXZlcnNlTWFwcGluZy5zZXQobmV3SWQsIG9yaWdpbmFsSWQpO1xyXG4gICAgdGhpcy5uYW1lTWFwcGluZy5zZXQobmFtZSwgbmV3SWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog66ek7ZWRIOy2lOqwgCAo67mE64+Z6riwLCDrs5HroKwg7Iuk7ZaJIOyLnCDsgqzsmqkgLSBUaHJlYWQtc2FmZSlcclxuICAgKiBVc2UgdGhpcyBtZXRob2Qgd2hlbiBhZGRpbmcgbWFwcGluZ3MgZnJvbSBwYXJhbGxlbCBvcGVyYXRpb25zIHRvIHByZXZlbnQgcmFjZSBjb25kaXRpb25zLlxyXG4gICAqL1xyXG4gIGFzeW5jIGFkZFNhZmUob3JpZ2luYWxJZDogc3RyaW5nLCBuZXdJZDogc3RyaW5nLCB0eXBlOiBFbnRpdHlUeXBlLCBuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMubG9jay5hY3F1aXJlKElkTWFwcGVyLkxPQ0tfS0VZLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMubWFwcGluZ1tvcmlnaW5hbElkXSA9IHsgbmV3SWQsIHR5cGUsIG5hbWUgfTtcclxuICAgICAgdGhpcy5yZXZlcnNlTWFwcGluZy5zZXQobmV3SWQsIG9yaWdpbmFsSWQpO1xyXG4gICAgICB0aGlzLm5hbWVNYXBwaW5nLnNldChuYW1lLCBuZXdJZCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOybkOuzuCBJROuhnCDsg4ggSUQg7KGw7ZqMXHJcbiAgICovXHJcbiAgZ2V0TmV3SWQob3JpZ2luYWxJZDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcclxuICAgIC8vIG5hbWU6IOygkeuRkOyCrCDsspjrpqxcclxuICAgIGlmIChvcmlnaW5hbElkLnN0YXJ0c1dpdGgoJ25hbWU6JykpIHtcclxuICAgICAgY29uc3QgbmFtZSA9IG9yaWdpbmFsSWQuc3Vic3RyaW5nKDUpO1xyXG4gICAgICByZXR1cm4gdGhpcy5uYW1lTWFwcGluZy5nZXQobmFtZSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5tYXBwaW5nW29yaWdpbmFsSWRdPy5uZXdJZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOydtOumhOycvOuhnCDsg4ggSUQg7KGw7ZqMXHJcbiAgICovXHJcbiAgZ2V0TmV3SWRCeU5hbWUobmFtZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLm5hbWVNYXBwaW5nLmdldChuYW1lKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOyDiCBJROuhnCDsm5Drs7ggSUQg7KGw7ZqMXHJcbiAgICovXHJcbiAgZ2V0T3JpZ2luYWxJZChuZXdJZDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLnJldmVyc2VNYXBwaW5nLmdldChuZXdJZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDsm5Drs7ggSUTroZwg7KCE7LK0IOunpO2VkSDsoJXrs7Qg7KGw7ZqMXHJcbiAgICovXHJcbiAgZ2V0TWFwcGluZyhvcmlnaW5hbElkOiBzdHJpbmcpOiBJZE1hcHBpbmdFbnRyeSB8IHVuZGVmaW5lZCB7XHJcbiAgICByZXR1cm4gdGhpcy5tYXBwaW5nW29yaWdpbmFsSWRdO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog66ek7ZWRIOyhtOyerCDsl6zrtoAg7ZmV7J24XHJcbiAgICovXHJcbiAgaGFzKG9yaWdpbmFsSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKG9yaWdpbmFsSWQuc3RhcnRzV2l0aCgnbmFtZTonKSkge1xyXG4gICAgICBjb25zdCBuYW1lID0gb3JpZ2luYWxJZC5zdWJzdHJpbmcoNSk7XHJcbiAgICAgIHJldHVybiB0aGlzLm5hbWVNYXBwaW5nLmhhcyhuYW1lKTtcclxuICAgIH1cclxuICAgIHJldHVybiBvcmlnaW5hbElkIGluIHRoaXMubWFwcGluZztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOydtOumhOycvOuhnCDrp6TtlZEg7KG07J6sIOyXrOu2gCDtmZXsnbhcclxuICAgKi9cclxuICBoYXNCeU5hbWUobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5uYW1lTWFwcGluZy5oYXMobmFtZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDsu6TsiqTthYAg7YWc7ZSM66a/IHR5cGUg66ek7ZWRIOy2lOqwgCAoY3Z0X29sZCDihpIgY3Z0X25ldylcclxuICAgKi9cclxuICBhZGRUZW1wbGF0ZVR5cGVNYXBwaW5nKG9yaWdpbmFsQ3Z0VHlwZTogc3RyaW5nLCBuZXdDdnRUeXBlOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMudGVtcGxhdGVUeXBlTWFwcGluZy5zZXQob3JpZ2luYWxDdnRUeXBlLCBuZXdDdnRUeXBlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOy7pOyKpO2FgCDthZztlIzrpr8gdHlwZSDrp6TtlZEg7KGw7ZqMXHJcbiAgICovXHJcbiAgZ2V0TmV3VGVtcGxhdGVUeXBlKG9yaWdpbmFsQ3Z0VHlwZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLnRlbXBsYXRlVHlwZU1hcHBpbmcuZ2V0KG9yaWdpbmFsQ3Z0VHlwZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDsoITssrQg66ek7ZWRIOuwmO2ZmFxyXG4gICAqL1xyXG4gIGdldEFsbCgpOiBJZE1hcHBpbmcge1xyXG4gICAgcmV0dXJuIHsgLi4udGhpcy5tYXBwaW5nIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDrp6TtlZEg6rCc7IiYXHJcbiAgICovXHJcbiAgZ2V0IHNpemUoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLm1hcHBpbmcpLmxlbmd0aDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIO2DgOyeheuzhCDrp6TtlZEg7ZWE7YSw66eBXHJcbiAgICovXHJcbiAgZmlsdGVyQnlUeXBlKHR5cGU6IEVudGl0eVR5cGUpOiBJZE1hcHBpbmcge1xyXG4gICAgY29uc3QgZmlsdGVyZWQ6IElkTWFwcGluZyA9IHt9O1xyXG5cclxuICAgIGZvciAoY29uc3QgW2lkLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5tYXBwaW5nKSkge1xyXG4gICAgICBpZiAodmFsdWUudHlwZSA9PT0gdHlwZSkge1xyXG4gICAgICAgIGZpbHRlcmVkW2lkXSA9IHZhbHVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZpbHRlcmVkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog7YWN7Iqk7Yq4IOuCtCBJRCDssLjsobAg67OA7ZmYXHJcbiAgICogKGZpcmluZ1RyaWdnZXJJZCwgY29uZmlnVGFnSWQg65OxIOyngeygkSBJRCDssLjsobDrp4wg67OA7ZmYKVxyXG4gICAqL1xyXG4gIHRyYW5zZm9ybUlkUmVmZXJlbmNlcyh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgbGV0IHJlc3VsdCA9IHRleHQ7XHJcblxyXG4gICAgZm9yIChjb25zdCBbb3JpZ2luYWxJZCwgeyBuZXdJZCB9XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1hcHBpbmcpKSB7XHJcbiAgICAgIC8vIG5hbWU6IOygkeuRkOyCrOuKlCDsiqTtgrVcclxuICAgICAgaWYgKG9yaWdpbmFsSWQuc3RhcnRzV2l0aCgnbmFtZTonKSkgY29udGludWU7XHJcblxyXG4gICAgICAvLyDsp4HsoJEgSUQg7LC47KGwIOuzgO2ZmFxyXG4gICAgICBjb25zdCBpZFBhdHRlcm4gPSBuZXcgUmVnRXhwKGBcXFxcYiR7dGhpcy5lc2NhcGVSZWdleChvcmlnaW5hbElkKX1cXFxcYmAsICdnJyk7XHJcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKGlkUGF0dGVybiwgbmV3SWQpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDrsLDsl7Qg64K0IElEIOuzgO2ZmFxyXG4gICAqL1xyXG4gIHRyYW5zZm9ybUlkQXJyYXkoaWRzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcclxuICAgIHJldHVybiBpZHMubWFwKGlkID0+IHRoaXMuZ2V0TmV3SWQoaWQpIHx8IGlkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOqwneyytCDrgrQg7Yq57KCVIO2VhOuTnOuTpOydmCBJRCDrs4DtmZhcclxuICAgKi9cclxuICB0cmFuc2Zvcm1PYmplY3Q8VCBleHRlbmRzIG9iamVjdD4oXHJcbiAgICBvYmo6IFQsXHJcbiAgICBpZEZpZWxkczogc3RyaW5nW11cclxuICApOiBUIHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IHsgLi4ub2JqIH0gYXMgYW55O1xyXG5cclxuICAgIGZvciAoY29uc3QgZmllbGQgb2YgaWRGaWVsZHMpIHtcclxuICAgICAgaWYgKGZpZWxkIGluIHJlc3VsdCAmJiByZXN1bHRbZmllbGRdKSB7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0W2ZpZWxkXSkpIHtcclxuICAgICAgICAgIHJlc3VsdFtmaWVsZF0gPSB0aGlzLnRyYW5zZm9ybUlkQXJyYXkocmVzdWx0W2ZpZWxkXSk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcmVzdWx0W2ZpZWxkXSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgIGNvbnN0IG5ld0lkID0gdGhpcy5nZXROZXdJZChyZXN1bHRbZmllbGRdKTtcclxuICAgICAgICAgIGlmIChuZXdJZCkge1xyXG4gICAgICAgICAgICByZXN1bHRbZmllbGRdID0gbmV3SWQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOunpO2VkSDstIjquLDtmZRcclxuICAgKi9cclxuICBjbGVhcigpOiB2b2lkIHtcclxuICAgIHRoaXMubWFwcGluZyA9IHt9O1xyXG4gICAgdGhpcy5yZXZlcnNlTWFwcGluZy5jbGVhcigpO1xyXG4gICAgdGhpcy5uYW1lTWFwcGluZy5jbGVhcigpO1xyXG4gICAgdGhpcy50ZW1wbGF0ZVR5cGVNYXBwaW5nLmNsZWFyKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBKU09O7Jy866GcIOyngeugrO2ZlFxyXG4gICAqL1xyXG4gIHRvSlNPTigpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMubWFwcGluZywgbnVsbCwgMik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBKU09O7JeQ7IScIOuzteybkFxyXG4gICAqL1xyXG4gIHN0YXRpYyBmcm9tSlNPTihqc29uOiBzdHJpbmcpOiBJZE1hcHBlciB7XHJcbiAgICBjb25zdCBtYXBwZXIgPSBuZXcgSWRNYXBwZXIoKTtcclxuICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGpzb24pIGFzIElkTWFwcGluZztcclxuXHJcbiAgICBmb3IgKGNvbnN0IFtvcmlnaW5hbElkLCBlbnRyeV0gb2YgT2JqZWN0LmVudHJpZXMoZGF0YSkpIHtcclxuICAgICAgbWFwcGVyLmFkZChvcmlnaW5hbElkLCBlbnRyeS5uZXdJZCwgZW50cnkudHlwZSwgZW50cnkubmFtZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG1hcHBlcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOuhnOq3uOyaqSDrrLjsnpDsl7RcclxuICAgKi9cclxuICB0b0xvZ1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gWydJRCBNYXBwaW5nOiddO1xyXG5cclxuICAgIGNvbnN0IGJ5VHlwZSA9IG5ldyBNYXA8RW50aXR5VHlwZSwgQXJyYXk8eyBvcmlnOiBzdHJpbmc7IG5ldzogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfT4+KCk7XHJcblxyXG4gICAgZm9yIChjb25zdCBbb3JpZ2luYWxJZCwgeyBuZXdJZCwgdHlwZSwgbmFtZSB9XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1hcHBpbmcpKSB7XHJcbiAgICAgIGlmICghYnlUeXBlLmhhcyh0eXBlKSkge1xyXG4gICAgICAgIGJ5VHlwZS5zZXQodHlwZSwgW10pO1xyXG4gICAgICB9XHJcbiAgICAgIGJ5VHlwZS5nZXQodHlwZSkhLnB1c2goeyBvcmlnOiBvcmlnaW5hbElkLCBuZXc6IG5ld0lkLCBuYW1lIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAoY29uc3QgW3R5cGUsIGVudHJpZXNdIG9mIGJ5VHlwZSkge1xyXG4gICAgICBsaW5lcy5wdXNoKGBcXG4gIFske3R5cGUudG9VcHBlckNhc2UoKX1dYCk7XHJcbiAgICAgIGZvciAoY29uc3QgeyBvcmlnLCBuZXc6IG5ld0lkLCBuYW1lIH0gb2YgZW50cmllcykge1xyXG4gICAgICAgIGxpbmVzLnB1c2goYCAgICBcIiR7bmFtZX1cIjogJHtvcmlnfSAtPiAke25ld0lkfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMudGVtcGxhdGVUeXBlTWFwcGluZy5zaXplID4gMCkge1xyXG4gICAgICBsaW5lcy5wdXNoKGBcXG4gIFtURU1QTEFURSBUWVBFIE1BUFBJTkddYCk7XHJcbiAgICAgIGZvciAoY29uc3QgW29sZFR5cGUsIG5ld1R5cGVdIG9mIHRoaXMudGVtcGxhdGVUeXBlTWFwcGluZykge1xyXG4gICAgICAgIGxpbmVzLnB1c2goYCAgICAke29sZFR5cGV9IC0+ICR7bmV3VHlwZX1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOygleq3nOyLnSDsnbTsiqTsvIDsnbTtlIRcclxuICAgKi9cclxuICBwcml2YXRlIGVzY2FwZVJlZ2V4KHN0cjogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBzdHIucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIOyLseq4gO2GpCDtjKnthqDrpqwgKOybjO2BrO2UjOuhnOyasCDshLjshZjsmqkpXHJcbmNvbnN0IHNlc3Npb25NYXBwZXJzID0gbmV3IE1hcDxzdHJpbmcsIElkTWFwcGVyPigpO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFNlc3Npb25NYXBwZXIoc2Vzc2lvbklkOiBzdHJpbmcpOiBJZE1hcHBlciB7XHJcbiAgaWYgKCFzZXNzaW9uTWFwcGVycy5oYXMoc2Vzc2lvbklkKSkge1xyXG4gICAgc2Vzc2lvbk1hcHBlcnMuc2V0KHNlc3Npb25JZCwgbmV3IElkTWFwcGVyKCkpO1xyXG4gIH1cclxuICByZXR1cm4gc2Vzc2lvbk1hcHBlcnMuZ2V0KHNlc3Npb25JZCkhO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJTZXNzaW9uTWFwcGVyKHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgc2Vzc2lvbk1hcHBlcnMuZGVsZXRlKHNlc3Npb25JZCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjbGVhckFsbFNlc3Npb25NYXBwZXJzKCk6IHZvaWQge1xyXG4gIHNlc3Npb25NYXBwZXJzLmNsZWFyKCk7XHJcbn1cclxuIl19