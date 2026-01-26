/**
 * Workflow Types
 * 워크플로우 상태 및 관련 타입 정의
 */

import {
  EntityType,
  GTMTag,
  GTMTrigger,
  GTMVariable,
  GTMTemplate,
  AnalysisResult,
  NamingPattern,
  IdMapping,
  CreationPlan,
  ValidationReport,
  CreatedEntity
} from 'gtm-agent-skills';
import { AgentError, WorkspaceContext } from './agent';

// ==================== Target Entities Cache ====================

export interface TargetEntities {
  tags: GTMTag[];
  triggers: GTMTrigger[];
  variables: GTMVariable[];
  templates: GTMTemplate[];
  loadedAt: number;
}

// ==================== Rollback Result ====================

export interface RollbackResult {
  attempted: number;
  succeeded: number;
  failed: Array<{
    entityId: string;
    entityType: EntityType;
    error: string;
  }>;
  isPartial: boolean;
}

// ==================== Workflow State ====================

export type WorkflowPhase =
  | 'idle'
  | 'analyzing'
  | 'naming'
  | 'planning'
  | 'building'
  | 'validating'
  | 'completed'
  | 'error';

export interface WorkflowState {
  sessionId: string;
  phase: WorkflowPhase;
  sourceWorkspace: WorkspaceContext;
  targetWorkspace: WorkspaceContext;
  startedAt?: string;
  completedAt?: string;

  // Analysis phase results
  analysisResult?: AnalysisResult;
  sourceEntities?: {
    tags: GTMTag[];
    triggers: GTMTrigger[];
    variables: GTMVariable[];
  };

  // Target entities cache (pre-loaded to avoid duplicate API calls)
  targetEntities?: TargetEntities;

  // Naming phase results
  namingPattern?: NamingPattern;
  entityNameMap?: Map<string, string>; // originalId -> newName

  // Planning phase results
  creationPlan?: CreationPlan;

  // Building phase results
  idMapping?: IdMapping;
  createdEntities: CreatedEntity[];

  // Validation phase results
  validationReport?: ValidationReport;

  // Errors and warnings
  errors: AgentError[];
  warnings: string[];
}

// ==================== Workflow Actions ====================

export type WorkflowAction =
  | { type: 'START'; payload: { source: WorkspaceContext; target: WorkspaceContext } }
  | { type: 'SET_ANALYSIS_RESULT'; payload: AnalysisResult }
  | { type: 'SET_SOURCE_ENTITIES'; payload: { tags: GTMTag[]; triggers: GTMTrigger[]; variables: GTMVariable[] } }
  | { type: 'SET_TARGET_ENTITIES'; payload: TargetEntities }
  | { type: 'SET_NAMING_PATTERN'; payload: NamingPattern }
  | { type: 'SET_ENTITY_NAME_MAP'; payload: Map<string, string> }
  | { type: 'SET_CREATION_PLAN'; payload: CreationPlan }
  | { type: 'ADD_CREATED_ENTITY'; payload: CreatedEntity }
  | { type: 'SET_ID_MAPPING'; payload: IdMapping }
  | { type: 'SET_VALIDATION_REPORT'; payload: ValidationReport }
  | { type: 'ADD_ERROR'; payload: AgentError }
  | { type: 'ADD_WARNING'; payload: string }
  | { type: 'TRANSITION_PHASE'; payload: WorkflowPhase }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

// ==================== Workflow Progress ====================

export interface WorkflowProgress {
  phase: WorkflowPhase;
  currentStep: number;
  totalSteps: number;
  description: string;
  percentage: number;
}

// ==================== Workflow Config ====================

export interface WorkflowConfig {
  dryRun?: boolean;
  skipNaming?: boolean;
  skipValidation?: boolean;
  autoRollback?: boolean;
  preserveNotes?: boolean;
  namePrefix?: string;
  nameSuffix?: string;
}

// ==================== Workflow Result ====================

export interface WorkflowResult {
  success: boolean;
  sessionId: string;
  sourceWorkspace: WorkspaceContext;
  targetWorkspace: WorkspaceContext;
  duration: number;
  summary: WorkflowSummary;
  createdEntities: CreatedEntity[];
  idMapping: IdMapping;
  validationReport?: ValidationReport;
  errors: AgentError[];
  warnings: string[];
}

export interface WorkflowSummary {
  analyzedCount: number;
  plannedCount: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
}

// ==================== Workflow Events ====================

export type WorkflowEventType =
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'phase_changed'
  | 'entity_created'
  | 'entity_skipped'
  | 'entity_failed'
  | 'progress_updated';

export interface WorkflowEvent {
  type: WorkflowEventType;
  timestamp: string;
  sessionId: string;
  data?: any;
}

export type WorkflowEventHandler = (event: WorkflowEvent) => void;

// ==================== Tag Selection ====================

export interface TagSelection {
  tagIds: string[];
  includeAllDependencies?: boolean;
  recursive?: boolean;
}

export interface TagFilter {
  types?: string[];
  namePattern?: string;
  limit?: number;
}
