import { api } from '../../../../lib/api';
import type { PaginatedResponse } from '@packages/common';
import type { User, Role, CreateUserRequest, ListUsersParams } from './types';

export function listUsers(params: ListUsersParams): Promise<PaginatedResponse<User>> {
  const searchParams = new URLSearchParams();

  if (params.page && params.page > 1) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.order) searchParams.set('order', params.order);
  if (params.userType) searchParams.set('userType', params.userType);

  const qs = searchParams.toString();
  return api.get<PaginatedResponse<User>>(`/users${qs ? `?${qs}` : ''}`);
}

export function createUser(data: CreateUserRequest): Promise<User> {
  return api.post<User>('/users', data);
}

export function listRoles(userType?: string): Promise<PaginatedResponse<Role>> {
  const params = new URLSearchParams({ limit: '100' });
  if (userType) params.set('userType', userType);
  return api.get<PaginatedResponse<Role>>(`/roles?${params.toString()}`);
}
