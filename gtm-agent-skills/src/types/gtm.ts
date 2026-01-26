/**
 * GTM Entity Types
 * GTM MCP 응답과 호환되는 타입 정의
 */

// GTM 엔티티 종류
export enum EntityType {
  TAG = 'tag',
  TRIGGER = 'trigger',
  VARIABLE = 'variable',
  TEMPLATE = 'template',
  FOLDER = 'folder'
}

// 변수 타입
export enum VariableType {
  DATA_LAYER = 'v',           // Data Layer Variable
  JAVASCRIPT = 'jsm',         // Custom JavaScript
  CONSTANT = 'c',             // Constant
  LOOKUP_TABLE = 'smm',       // Lookup Table
  REGEX_TABLE = 'remm',       // RegEx Table
  DOM_ELEMENT = 'd',          // DOM Element
  FIRST_PARTY_COOKIE = 'k',   // 1st Party Cookie
  URL = 'u',                  // URL Variable
  AUTO_EVENT = 'aev',         // Auto-Event Variable
  CUSTOM_EVENT = 'ev',        // Custom Event
  GA_SETTINGS = 'gas',        // Google Analytics Settings
  UNDEFINED = 'uv'            // Undefined Value
}

// GTM Parameter (공통 구조)
export interface GTMParameter {
  type: string;
  key: string;
  value?: string;
  list?: GTMParameter[];
  map?: GTMParameter[];
}

// GTM Filter (트리거 조건)
export interface GTMFilter {
  type: string;
  parameter: GTMFilterParameter[];
}

export interface GTMFilterParameter {
  type: string;
  key: string;
  value?: string;
}

// GTM Tag
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
  setupTag?: Array<{ tagId?: string; tagName?: string }>;
  teardownTag?: Array<{ tagId?: string; tagName?: string }>;
  templateId?: string;
  fingerprint?: string;
  tagFiringOption?: string;
  notes?: string;
  path?: string;
}

// GTM Trigger
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

// GTM Variable
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

// GTM Template
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

// GTM 엔티티 유니온 타입
export type GTMEntity = GTMTag | GTMTrigger | GTMVariable | GTMTemplate;

// 엔티티 ID 추출 헬퍼
export function getEntityId(entity: GTMEntity): string {
  if ('tagId' in entity) return entity.tagId;
  if ('triggerId' in entity) return entity.triggerId;
  if ('variableId' in entity) return entity.variableId;
  if ('templateId' in entity) return entity.templateId;
  throw new Error('Unknown entity type');
}

// 엔티티 타입 판별 헬퍼
export function getEntityType(entity: GTMEntity): EntityType {
  if ('tagId' in entity) return EntityType.TAG;
  if ('triggerId' in entity) return EntityType.TRIGGER;
  if ('variableId' in entity) return EntityType.VARIABLE;
  if ('templateId' in entity) return EntityType.TEMPLATE;
  throw new Error('Unknown entity type');
}
