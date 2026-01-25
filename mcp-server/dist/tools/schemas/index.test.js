/**
 * Schemas Index Tests
 * 모든 스키마가 올바르게 export 되고 올바른 구조를 가지는지 검증
 */
import { describe, it, expect } from "vitest";
import { allSchemas, gtmContextSchema, gtmAccountSchema, gtmContainerSchema, gtmWorkspaceSchema, gtmTagSchema, gtmTriggerSchema, gtmVariableSchema, gtmVersionSchema, gtmBuiltInVariableSchema, gtmClientSchema, gtmDestinationSchema, gtmEnvironmentSchema, gtmFolderSchema, gtmGtagConfigSchema, gtmTemplateSchema, gtmTransformationSchema, gtmUserPermissionSchema, gtmVersionHeaderSchema, gtmZoneSchema, gtmExportFullSchema, gtmRemoveSessionSchema, gtmCacheSchema, } from "./index.js";
describe("Schemas Module", () => {
    describe("allSchemas array", () => {
        it("should export exactly 22 schemas", () => {
            expect(allSchemas).toHaveLength(22);
        });
        it("should contain all required schema names", () => {
            const schemaNames = allSchemas.map((s) => s.name);
            expect(schemaNames).toContain("gtm_context");
            expect(schemaNames).toContain("gtm_account");
            expect(schemaNames).toContain("gtm_container");
            expect(schemaNames).toContain("gtm_workspace");
            expect(schemaNames).toContain("gtm_tag");
            expect(schemaNames).toContain("gtm_trigger");
            expect(schemaNames).toContain("gtm_variable");
            expect(schemaNames).toContain("gtm_version");
            expect(schemaNames).toContain("gtm_version_header");
            expect(schemaNames).toContain("gtm_built_in_variable");
            expect(schemaNames).toContain("gtm_client");
            expect(schemaNames).toContain("gtm_destination");
            expect(schemaNames).toContain("gtm_environment");
            expect(schemaNames).toContain("gtm_folder");
            expect(schemaNames).toContain("gtm_gtag_config");
            expect(schemaNames).toContain("gtm_template");
            expect(schemaNames).toContain("gtm_transformation");
            expect(schemaNames).toContain("gtm_user_permission");
            expect(schemaNames).toContain("gtm_zone");
            expect(schemaNames).toContain("gtm_export_full");
            expect(schemaNames).toContain("gtm_remove_session");
            expect(schemaNames).toContain("gtm_cache");
        });
    });
    describe("Schema structure validation", () => {
        const validateSchemaStructure = (schema) => {
            expect(schema).toHaveProperty("name");
            expect(schema).toHaveProperty("description");
            expect(schema).toHaveProperty("inputSchema");
            expect(schema.inputSchema).toHaveProperty("type", "object");
            expect(schema.inputSchema).toHaveProperty("properties");
            expect(schema.inputSchema).toHaveProperty("required");
            expect(Array.isArray(schema.inputSchema.required)).toBe(true);
        };
        it("gtmContextSchema has valid structure", () => {
            validateSchemaStructure(gtmContextSchema);
            expect(gtmContextSchema.name).toBe("gtm_context");
            expect(gtmContextSchema.inputSchema.required).toContain("action");
        });
        it("gtmAccountSchema has valid structure", () => {
            validateSchemaStructure(gtmAccountSchema);
            expect(gtmAccountSchema.name).toBe("gtm_account");
            expect(gtmAccountSchema.inputSchema.required).toContain("action");
        });
        it("gtmContainerSchema has valid structure", () => {
            validateSchemaStructure(gtmContainerSchema);
            expect(gtmContainerSchema.name).toBe("gtm_container");
            expect(gtmContainerSchema.inputSchema.required).toContain("action");
            expect(gtmContainerSchema.inputSchema.required).toContain("accountId");
        });
        it("gtmWorkspaceSchema has valid structure", () => {
            validateSchemaStructure(gtmWorkspaceSchema);
            expect(gtmWorkspaceSchema.name).toBe("gtm_workspace");
            expect(gtmWorkspaceSchema.inputSchema.required).toContain("action");
            expect(gtmWorkspaceSchema.inputSchema.required).toContain("accountId");
            expect(gtmWorkspaceSchema.inputSchema.required).toContain("containerId");
        });
        it("gtmTagSchema has valid structure", () => {
            validateSchemaStructure(gtmTagSchema);
            expect(gtmTagSchema.name).toBe("gtm_tag");
            expect(gtmTagSchema.inputSchema.required).toContain("action");
            expect(gtmTagSchema.inputSchema.required).toContain("accountId");
            expect(gtmTagSchema.inputSchema.required).toContain("containerId");
            expect(gtmTagSchema.inputSchema.required).toContain("workspaceId");
        });
        it("gtmTriggerSchema has valid structure", () => {
            validateSchemaStructure(gtmTriggerSchema);
            expect(gtmTriggerSchema.name).toBe("gtm_trigger");
        });
        it("gtmVariableSchema has valid structure", () => {
            validateSchemaStructure(gtmVariableSchema);
            expect(gtmVariableSchema.name).toBe("gtm_variable");
        });
        it("gtmVersionSchema has valid structure", () => {
            validateSchemaStructure(gtmVersionSchema);
            expect(gtmVersionSchema.name).toBe("gtm_version");
        });
        it("gtmBuiltInVariableSchema has valid structure", () => {
            validateSchemaStructure(gtmBuiltInVariableSchema);
            expect(gtmBuiltInVariableSchema.name).toBe("gtm_built_in_variable");
        });
        it("gtmClientSchema has valid structure", () => {
            validateSchemaStructure(gtmClientSchema);
            expect(gtmClientSchema.name).toBe("gtm_client");
        });
        it("gtmDestinationSchema has valid structure", () => {
            validateSchemaStructure(gtmDestinationSchema);
            expect(gtmDestinationSchema.name).toBe("gtm_destination");
        });
        it("gtmEnvironmentSchema has valid structure", () => {
            validateSchemaStructure(gtmEnvironmentSchema);
            expect(gtmEnvironmentSchema.name).toBe("gtm_environment");
        });
        it("gtmFolderSchema has valid structure", () => {
            validateSchemaStructure(gtmFolderSchema);
            expect(gtmFolderSchema.name).toBe("gtm_folder");
        });
        it("gtmGtagConfigSchema has valid structure", () => {
            validateSchemaStructure(gtmGtagConfigSchema);
            expect(gtmGtagConfigSchema.name).toBe("gtm_gtag_config");
        });
        it("gtmTemplateSchema has valid structure", () => {
            validateSchemaStructure(gtmTemplateSchema);
            expect(gtmTemplateSchema.name).toBe("gtm_template");
        });
        it("gtmTransformationSchema has valid structure", () => {
            validateSchemaStructure(gtmTransformationSchema);
            expect(gtmTransformationSchema.name).toBe("gtm_transformation");
        });
        it("gtmUserPermissionSchema has valid structure", () => {
            validateSchemaStructure(gtmUserPermissionSchema);
            expect(gtmUserPermissionSchema.name).toBe("gtm_user_permission");
        });
        it("gtmVersionHeaderSchema has valid structure", () => {
            validateSchemaStructure(gtmVersionHeaderSchema);
            expect(gtmVersionHeaderSchema.name).toBe("gtm_version_header");
        });
        it("gtmZoneSchema has valid structure", () => {
            validateSchemaStructure(gtmZoneSchema);
            expect(gtmZoneSchema.name).toBe("gtm_zone");
        });
        it("gtmExportFullSchema has valid structure", () => {
            validateSchemaStructure(gtmExportFullSchema);
            expect(gtmExportFullSchema.name).toBe("gtm_export_full");
        });
        it("gtmRemoveSessionSchema has valid structure", () => {
            validateSchemaStructure(gtmRemoveSessionSchema);
            expect(gtmRemoveSessionSchema.name).toBe("gtm_remove_session");
        });
        it("gtmCacheSchema has valid structure", () => {
            validateSchemaStructure(gtmCacheSchema);
            expect(gtmCacheSchema.name).toBe("gtm_cache");
        });
    });
    describe("Action enum validation", () => {
        it("gtmContextSchema should have get, set, clear actions", () => {
            const actions = gtmContextSchema.inputSchema.properties.action?.enum;
            expect(actions).toContain("get");
            expect(actions).toContain("set");
            expect(actions).toContain("clear");
        });
        it("gtmAccountSchema should have get, list, update actions", () => {
            const actions = gtmAccountSchema.inputSchema.properties.action?.enum;
            expect(actions).toContain("get");
            expect(actions).toContain("list");
            expect(actions).toContain("update");
        });
        it("gtmTagSchema should have CRUD + revert actions", () => {
            const actions = gtmTagSchema.inputSchema.properties.action?.enum;
            expect(actions).toContain("create");
            expect(actions).toContain("get");
            expect(actions).toContain("list");
            expect(actions).toContain("update");
            expect(actions).toContain("remove");
            expect(actions).toContain("revert");
        });
        it("gtmCacheSchema should have clear, clearAll, stats actions", () => {
            const actions = gtmCacheSchema.inputSchema.properties.action?.enum;
            expect(actions).toContain("clear");
            expect(actions).toContain("clearAll");
            expect(actions).toContain("stats");
        });
    });
});
