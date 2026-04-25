// Module
export { WorkflowsModule } from './workflows.module';
export { WORKFLOWS_PERMISSIONS } from './permissions';

// Services
export { WorkflowEngineService } from './services/workflow-engine.service';
export { TransitionWorkflowAction } from './services/transition-workflow.action';
export { WorkflowRegistryService } from './services/workflow-registry.service';
export { PipelineResolverService } from './services/pipeline-resolver.service';

// Types
export type {
  TransitionPreflight,
  CachedWorkflowDefinition,
  CachedWorkflowState,
  CachedWorkflowTransition,
  AvailableTransition,
  ValidatedTransition,
  RecordHistoryParams,
  TransitionHistoryEntry,
  ValidationResult,
} from './types';

// Schema tables
export {
  workflowDefinitions,
  workflowStates,
  workflowTransitions,
  workflowTransitionHistory,
  entityPipelineAssignments,
} from './schema';

// Feature deriver + reader
export {
  WORKFLOW_FEATURE_KEY,
  workflowFeatureDeriver,
  readWorkflowFeature,
  type WorkflowFeatureBag,
} from './feature';

// Transition guard helper for per-entity service composition
export { runTransitionGuards, previewTransitionGuards } from './transition-guard';
export type { TransitionGuard, GuardCtx, GuardOutcome } from './transition-guard';
