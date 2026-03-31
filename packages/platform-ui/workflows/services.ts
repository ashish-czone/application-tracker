import type { ApiFn } from '../PlatformUIProvider';
import type {
  WorkflowDefinition,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  CreateStateRequest,
  UpdateStateRequest,
  CreateTransitionRequest,
  UpdateTransitionRequest,
  WorkflowState,
  WorkflowTransition,
  TransitionHistoryEntry,
} from './types';

export function createWorkflowsApi(api: ApiFn) {
  return {
    // Definitions
    listWorkflows(): Promise<WorkflowDefinition[]> {
      return api.get<WorkflowDefinition[]>('/workflows');
    },
    getWorkflow(slug: string): Promise<WorkflowDefinition> {
      return api.get<WorkflowDefinition>(`/workflows/${slug}`);
    },
    createWorkflow(data: CreateWorkflowRequest): Promise<WorkflowDefinition> {
      return api.post<WorkflowDefinition>('/workflows', data);
    },
    updateWorkflow(id: string, data: UpdateWorkflowRequest): Promise<WorkflowDefinition> {
      return api.patch<WorkflowDefinition>(`/workflows/${id}`, data);
    },
    deleteWorkflow(id: string): Promise<void> {
      return api.delete<void>(`/workflows/${id}`);
    },

    // States
    createState(definitionId: string, data: CreateStateRequest): Promise<WorkflowState> {
      return api.post<WorkflowState>(`/workflows/${definitionId}/states`, data);
    },
    updateState(stateId: string, data: UpdateStateRequest): Promise<WorkflowState> {
      return api.patch<WorkflowState>(`/workflows/states/${stateId}`, data);
    },
    deleteState(stateId: string): Promise<void> {
      return api.delete<void>(`/workflows/states/${stateId}`);
    },

    // Transitions
    createTransition(definitionId: string, data: CreateTransitionRequest): Promise<WorkflowTransition> {
      return api.post<WorkflowTransition>(`/workflows/${definitionId}/transitions`, data);
    },
    updateTransition(transitionId: string, data: UpdateTransitionRequest): Promise<WorkflowTransition> {
      return api.patch<WorkflowTransition>(`/workflows/transitions/${transitionId}`, data);
    },
    deleteTransition(transitionId: string): Promise<void> {
      return api.delete<void>(`/workflows/transitions/${transitionId}`);
    },

    // Entity pipeline resolution
    getWorkflowForEntity(entityType: string, entityId: string, fieldName: string): Promise<WorkflowDefinition> {
      return api.get<WorkflowDefinition>(`/workflows/for-entity/${entityType}/${entityId}/${fieldName}`);
    },

    // History
    getTransitionHistory(entityType: string, entityId: string): Promise<TransitionHistoryEntry[]> {
      return api.get<TransitionHistoryEntry[]>(`/workflows/history/${entityType}/${entityId}`);
    },

    // Entity transition execution
    executeTransition(
      entitySlug: string,
      entityId: string,
      body: { fieldKey: string; to: string; comment?: string },
    ): Promise<Record<string, unknown>> {
      return api.post<Record<string, unknown>>(`/${entitySlug}/${entityId}/transition`, body);
    },
  };
}

export type WorkflowsApi = ReturnType<typeof createWorkflowsApi>;
