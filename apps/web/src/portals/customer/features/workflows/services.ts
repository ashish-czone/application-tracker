import { api } from '../../../../lib/api';
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
} from './types';

// Definitions
export function listWorkflows(): Promise<WorkflowDefinition[]> {
  return api.get<WorkflowDefinition[]>('/workflows');
}

export function getWorkflow(slug: string): Promise<WorkflowDefinition> {
  return api.get<WorkflowDefinition>(`/workflows/${slug}`);
}

export function createWorkflow(data: CreateWorkflowRequest): Promise<WorkflowDefinition> {
  return api.post<WorkflowDefinition>('/workflows', data);
}

export function updateWorkflow(id: string, data: UpdateWorkflowRequest): Promise<WorkflowDefinition> {
  return api.patch<WorkflowDefinition>(`/workflows/${id}`, data);
}

export function deleteWorkflow(id: string): Promise<void> {
  return api.delete<void>(`/workflows/${id}`);
}

// States
export function createState(definitionId: string, data: CreateStateRequest): Promise<WorkflowState> {
  return api.post<WorkflowState>(`/workflows/${definitionId}/states`, data);
}

export function updateState(stateId: string, data: UpdateStateRequest): Promise<WorkflowState> {
  return api.patch<WorkflowState>(`/workflows/states/${stateId}`, data);
}

export function deleteState(stateId: string): Promise<void> {
  return api.delete<void>(`/workflows/states/${stateId}`);
}

// Transitions
export function createTransition(definitionId: string, data: CreateTransitionRequest): Promise<WorkflowTransition> {
  return api.post<WorkflowTransition>(`/workflows/${definitionId}/transitions`, data);
}

export function updateTransition(transitionId: string, data: UpdateTransitionRequest): Promise<WorkflowTransition> {
  return api.patch<WorkflowTransition>(`/workflows/transitions/${transitionId}`, data);
}

export function deleteTransition(transitionId: string): Promise<void> {
  return api.delete<void>(`/workflows/transitions/${transitionId}`);
}
