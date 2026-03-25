import { api } from '../../../../lib/api';
import type { PaginatedResponse } from '@packages/common';
import type {
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  PermissionEntry,
  PermissionRegistryEntry,
  ScopedPermissions,
  ListRolesParams,
} from './types';

export function listRoles(params: ListRolesParams): Promise<PaginatedResponse<Role>> {
  const searchParams = new URLSearchParams();

  if (params.page && params.page > 1) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  if (params.userType) searchParams.set('userType', params.userType);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.order) searchParams.set('order', params.order);

  const qs = searchParams.toString();
  return api.get<PaginatedResponse<Role>>(`/roles${qs ? `?${qs}` : ''}`);
}

export function createRole(data: CreateRoleRequest): Promise<Role> {
  return api.post<Role>('/roles', data);
}

export function updateRole(id: string, data: UpdateRoleRequest): Promise<Role> {
  return api.patch<Role>(`/roles/${id}`, data);
}

export function deleteRole(id: string): Promise<void> {
  return api.delete<void>(`/roles/${id}`);
}

export function getRoleUserCount(roleId: string): Promise<{ count: number }> {
  return api.get<{ count: number }>(`/roles/${roleId}/user-count`);
}

export function getRolePermissions(roleId: string): Promise<ScopedPermissions> {
  return api.get<ScopedPermissions>(`/roles/${roleId}/permissions`);
}

export function setRolePermissions(roleId: string, permissions: PermissionEntry[]): Promise<ScopedPermissions> {
  return api.put<ScopedPermissions>(`/roles/${roleId}/permissions`, { permissions });
}

export function getPermissionRegistry(): Promise<PermissionRegistryEntry[]> {
  return api.get<PermissionRegistryEntry[]>('/permissions/registry');
}
