import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '../PlatformUIProvider';
import type { Task, CreateTaskRequest, UpdateTaskRequest, TransitionRequest, TaskTransition, ListTasksParams } from './types';

export function createTasksApi(api: ApiFn) {
  return {
    listTasks(params: ListTasksParams): Promise<PaginatedResponse<Task>> {
      const searchParams = new URLSearchParams();
      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.search) searchParams.set('search', params.search);
      if (params.sort) searchParams.set('sort', params.sort);
      if (params.order) searchParams.set('order', params.order);
      if (params.status) searchParams.set('status', params.status);
      if (params.priority) searchParams.set('priority', params.priority);
      if (params.assigneeId) searchParams.set('assigneeId', params.assigneeId);
      if (params.includeDeleted) searchParams.set('includeDeleted', 'true');
      const qs = searchParams.toString();
      return api.get<PaginatedResponse<Task>>(`/tasks${qs ? `?${qs}` : ''}`);
    },
    createTask(data: CreateTaskRequest): Promise<Task> {
      return api.post<Task>('/tasks', data);
    },
    updateTask(id: string, data: UpdateTaskRequest): Promise<Task> {
      return api.patch<Task>(`/tasks/${id}`, data);
    },
    deleteTask(id: string): Promise<void> {
      return api.delete<void>(`/tasks/${id}`);
    },
    getTaskTransitions(id: string): Promise<TaskTransition[]> {
      return api.get<TaskTransition[]>(`/tasks/${id}/transitions`);
    },
    transitionTask(id: string, data: TransitionRequest): Promise<Task> {
      return api.patch<Task>(`/tasks/${id}/transition`, data);
    },
  };
}

export type TasksUiApi = ReturnType<typeof createTasksApi>;
