import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  createState,
  updateState,
  deleteState,
  createTransition,
  updateTransition,
  deleteTransition,
} from './services';
import type {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  CreateStateRequest,
  UpdateStateRequest,
  CreateTransitionRequest,
  UpdateTransitionRequest,
} from './types';

// Definitions
export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => listWorkflows(),
  });
}

export function useWorkflow(slug: string) {
  return useQuery({
    queryKey: ['workflows', slug],
    queryFn: () => getWorkflow(slug),
    enabled: !!slug,
  });
}

export function useCreateWorkflow(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkflowRequest) => createWorkflow(data),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkflowRequest }) => updateWorkflow(id, data),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ definitionId, data }: { definitionId: string; data: CreateStateRequest }) =>
      createState(definitionId, data),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stateId, data }: { stateId: string; data: UpdateStateRequest }) =>
      updateState(stateId, data),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stateId: string) => deleteState(stateId),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ definitionId, data }: { definitionId: string; data: CreateTransitionRequest }) =>
      createTransition(definitionId, data),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transitionId, data }: { transitionId: string; data: UpdateTransitionRequest }) =>
      updateTransition(transitionId, data),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transitionId: string) => deleteTransition(transitionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', slug] });
      toast.success('Transition removed');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to remove transition');
    },
  });
}
