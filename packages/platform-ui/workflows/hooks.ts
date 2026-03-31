import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '../PlatformUIProvider';
import { createWorkflowsApi } from './services';
import type {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  CreateStateRequest,
  UpdateStateRequest,
  CreateTransitionRequest,
  UpdateTransitionRequest,
} from './types';

function useWorkflowsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createWorkflowsApi(apiFn), [apiFn]);
}

// Definitions
export function useWorkflows() {
  const api = useWorkflowsApi();
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.listWorkflows(),
  });
}

export function useWorkflow(slug: string) {
  const api = useWorkflowsApi();
  return useQuery({
    queryKey: ['workflows', slug],
    queryFn: () => api.getWorkflow(slug),
    enabled: !!slug,
  });
}

export function useCreateWorkflow(options?: { onSuccess?: () => void }) {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkflowRequest) => api.createWorkflow(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create workflow');
    },
  });
}

export function useUpdateWorkflow() {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkflowRequest }) => api.updateWorkflow(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow updated');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update workflow');
    },
  });
}

export function useDeleteWorkflow(options?: { onSuccess?: () => void }) {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete workflow');
    },
  });
}

// States
export function useCreateState(slug: string) {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ definitionId, data }: { definitionId: string; data: CreateStateRequest }) =>
      api.createState(definitionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', slug] });
      toast.success('State added');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to add state');
    },
  });
}

export function useUpdateState(slug: string) {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stateId, data }: { stateId: string; data: UpdateStateRequest }) =>
      api.updateState(stateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', slug] });
      toast.success('State updated');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update state');
    },
  });
}

export function useDeleteState(slug: string) {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stateId: string) => api.deleteState(stateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', slug] });
      toast.success('State removed');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to remove state');
    },
  });
}

// Transitions
export function useCreateTransition(slug: string) {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ definitionId, data }: { definitionId: string; data: CreateTransitionRequest }) =>
      api.createTransition(definitionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', slug] });
      toast.success('Transition added');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to add transition');
    },
  });
}

export function useUpdateTransition(slug: string) {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transitionId, data }: { transitionId: string; data: UpdateTransitionRequest }) =>
      api.updateTransition(transitionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', slug] });
      toast.success('Transition updated');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update transition');
    },
  });
}

export function useDeleteTransition(slug: string) {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transitionId: string) => api.deleteTransition(transitionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', slug] });
      toast.success('Transition removed');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to remove transition');
    },
  });
}

// Entity pipeline resolution
export function useWorkflowForEntity(entityType: string, entityId: string, fieldName: string) {
  const api = useWorkflowsApi();
  return useQuery({
    queryKey: ['workflow-for-entity', entityType, entityId, fieldName],
    queryFn: () => api.getWorkflowForEntity(entityType, entityId, fieldName),
    enabled: !!entityType && !!entityId && !!fieldName,
  });
}

// History
export function useTransitionHistory(entityType: string, entityId: string) {
  const api = useWorkflowsApi();
  return useQuery({
    queryKey: ['workflow-history', entityType, entityId],
    queryFn: () => api.getTransitionHistory(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

// Entity transition execution
export function useEntityTransition(
  entitySlug: string,
  entityType: string,
  singularName: string,
  options?: { onSuccess?: () => void },
) {
  const api = useWorkflowsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: string; fieldKey: string; to: string; comment?: string }) =>
      api.executeTransition(entitySlug, body.id, { fieldKey: body.fieldKey, to: body.to, comment: body.comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityType] });
      queryClient.invalidateQueries({ queryKey: ['workflow-history'] });
      toast.success(`${singularName} transitioned`);
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || `Failed to transition ${singularName.toLowerCase()}`);
    },
  });
}
