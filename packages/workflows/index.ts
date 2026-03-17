// Module
export { WorkflowsModule } from './workflows.module';

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
  TransitionResult,
  TransitionHistoryEntry,
  TransitionParams,
  ValidationResult,
  WorkflowTransitionCompletedEvent,
} from './types';

// Event constant
export { WORKFLOWS_TRANSITION_COMPLETED } from './types';

// Schema tables
export {
  workflowDefinitions,
  workflowStates,
  workflowTransitions,
  workflowTransitionHistory,
} from './schema';
