import type { ApiFn } from '@packages/platform-ui';
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
  TransitionPreflight,
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

    // Preflight: legality + missing permissions only (no guards). Per-entity
    // guard preview lives on per-entity controllers (`/{slug}/{id}/transition-preview`)
    // and the hook merges results client-side.
    preflightTransition(params: {
      workflowSlug: string;
      entityType: string;
      entityId: string;
      fromState: string;
      toState: string;
    }): Promise<TransitionPreflight> {
      const qs = new URLSearchParams(params).toString();
      return api.get<TransitionPreflight>(`/workflows/preflight?${qs}`);
    },

    // Per-entity transition preview — calls the entity controller's
    // `:id/transition-preview` route to collect per-entity guard warnings
    // and blockers. Returns empty arrays if the entity exposes no preview
    // route (404 surfaces as a network error; callers swallow it via the
    // preview hook below).
    previewEntityTransition(
      entitySlug: string,
      entityId: string,
      params: { fieldKey: string; to: string },
    ): Promise<{ warnings: string[]; blockers: string[] }> {
      const qs = new URLSearchParams(params).toString();
      return api.get<{ warnings: string[]; blockers: string[] }>(
        `/${entitySlug}/${entityId}/transition-preview?${qs}`,
      );
    },

    // Entity transition execution
    executeTransition(
      entitySlug: string,
      entityId: string,
      body: { fieldKey: string; to: string; reason?: string; comment?: string },
    ): Promise<Record<string, unknown>> {
      return api.post<Record<string, unknown>>(`/${entitySlug}/${entityId}/transition`, body);
    },
  };
}

export type WorkflowsApi = ReturnType<typeof createWorkflowsApi>;
