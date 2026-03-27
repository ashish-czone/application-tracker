import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '../PlatformUIProvider';
import type { User, Role, CreateUserRequest, UpdateUserRequest, ListUsersParams } from './types';

export function createUsersApi(api: ApiFn) {
  return {
    listUsers(params: ListUsersParams): Promise<PaginatedResponse<User>> {
      const searchParams = new URLSearchParams();
      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.search) searchParams.set('search', params.search);
      if (params.sort) searchParams.set('sort', params.sort);
      if (params.order) searchParams.set('order', params.order);
      if (params.userType) searchParams.set('userType', params.userType);
      if (params.includeDeleted) searchParams.set('includeDeleted', 'true');
      const qs = searchParams.toString();
      return api.get<PaginatedResponse<User>>(`/users${qs ? `?${qs}` : ''}`);
    },
    createUser(data: CreateUserRequest): Promise<User> {
      return api.post<User>('/users', data);
    },
    updateUser(id: string, data: UpdateUserRequest): Promise<User> {
      return api.patch<User>(`/users/${id}`, data);
    },
    deleteUser(id: string): Promise<void> {
      return api.delete<void>(`/users/${id}`);
    },
    restoreUser(id: string): Promise<User> {
      return api.patch<User>(`/users/${id}/restore`);
    },
    resetUserPassword(id: string, password: string): Promise<void> {
      return api.post<void>(`/users/${id}/reset-password`, { password });
    },
    checkUnique(entity: string, field: string, value: string, excludeId?: string): Promise<{ unique: boolean }> {
      const params = new URLSearchParams({ entity, field, value });
      if (excludeId) params.set('excludeId', excludeId);
      return api.get<{ unique: boolean }>(`/check-unique?${params.toString()}`);
    },
    listRoles(userType?: string): Promise<PaginatedResponse<Role>> {
      const params = new URLSearchParams({ limit: '100' });
      if (userType) params.set('userType', userType);
      return api.get<PaginatedResponse<Role>>(`/roles?${params.toString()}`);
    },
  };
}

export type UsersUiApi = ReturnType<typeof createUsersApi>;
