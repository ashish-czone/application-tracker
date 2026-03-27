// Module
export { WorkflowsModule } from './workflows.module';
export { WORKFLOWS_PERMISSIONS } from './permissions';

// Services
export { WorkflowEngineService } from './services/workflow-engine.service';
export { WorkflowRegistryService } from './services/workflow-registry.service';
export { WorkflowGuardRegistry } from './services/workflow-guard-registry.service';

// Types
export type {
  WorkflowGuardContext,
  WorkflowGuardFn,
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
} from './schema';
