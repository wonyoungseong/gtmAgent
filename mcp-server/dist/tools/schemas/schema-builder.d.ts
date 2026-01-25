/**
 * Schema Builder Pattern
 * 공통 필드와 패턴을 재사용하여 스키마 생성
 */
import { ToolSchema, ToolSchemaProperty, PAGE_SIZES } from "../types.js";
export type HierarchyLevel = "account" | "container" | "workspace";
export interface EntitySchemaConfig {
    name: string;
    entityName: string;
    description: string;
    hierarchy: HierarchyLevel;
    idField?: string;
    idDescription?: string;
    actions: string[];
    pageSize?: number;
    extraFields?: Record<string, ToolSchemaProperty>;
    extraRequired?: string[];
    includeCrudFields?: boolean;
}
/**
 * 엔티티 스키마 생성 팩토리
 */
export declare function createEntitySchema(config: EntitySchemaConfig): ToolSchema;
export { PAGE_SIZES };
