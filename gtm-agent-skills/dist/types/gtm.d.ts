/**
 * GTM Entity Types
 * GTM MCP 응답과 호환되는 타입 정의
 */
export declare enum EntityType {
    TAG = "tag",
    TRIGGER = "trigger",
    VARIABLE = "variable",
    TEMPLATE = "template",
    FOLDER = "folder"
}
export declare enum VariableType {
    DATA_LAYER = "v",// Data Layer Variable
    JAVASCRIPT = "jsm",// Custom JavaScript
    CONSTANT = "c",// Constant
    LOOKUP_TABLE = "smm",// Lookup Table
    REGEX_TABLE = "remm",// RegEx Table
    DOM_ELEMENT = "d",// DOM Element
    FIRST_PARTY_COOKIE = "k",// 1st Party Cookie
    URL = "u",// URL Variable
    AUTO_EVENT = "aev",// Auto-Event Variable
    CUSTOM_EVENT = "ev",// Custom Event
    GA_SETTINGS = "gas",// Google Analytics Settings
    UNDEFINED = "uv"
}
export interface GTMParameter {
    type: string;
    key: string;
    value?: string;
    list?: GTMParameter[];
    map?: GTMParameter[];
}
export interface GTMFilter {
    type: string;
    parameter: GTMFilterParameter[];
}
export interface GTMFilterParameter {
    type: string;
    key: string;
    value?: string;
}
export interface GTMTag {
    accountId: string;
    containerId: string;
    workspaceId: string;
    tagId: string;
    name: string;
    type: string;
    parameter?: GTMParameter[];
    firingTriggerId?: string[];
    blockingTriggerId?: string[];
    setupTag?: Array<{
        tagId?: string;
        tagName?: string;
    }>;
    teardownTag?: Array<{
        tagId?: string;
        tagName?: string;
    }>;
    templateId?: string;
    fingerprint?: string;
    tagFiringOption?: string;
    notes?: string;
    path?: string;
}
export interface GTMTrigger {
    accountId: string;
    containerId: string;
    workspaceId: string;
    triggerId: string;
    name: string;
    type: string;
    parameter?: GTMParameter[];
    filter?: GTMFilter[];
    autoEventFilter?: GTMFilter[];
    customEventFilter?: GTMFilter[];
    fingerprint?: string;
    notes?: string;
    path?: string;
}
export interface GTMVariable {
    accountId: string;
    containerId: string;
    workspaceId: string;
    variableId: string;
    name: string;
    type: string;
    parameter?: GTMParameter[];
    fingerprint?: string;
    notes?: string;
    path?: string;
}
export interface GTMTemplate {
    accountId: string;
    containerId: string;
    workspaceId: string;
    templateId: string;
    name: string;
    templateData?: string;
    fingerprint?: string;
    path?: string;
}
export type GTMEntity = GTMTag | GTMTrigger | GTMVariable | GTMTemplate;
export declare function getEntityId(entity: GTMEntity): string;
export declare function getEntityType(entity: GTMEntity): EntityType;
