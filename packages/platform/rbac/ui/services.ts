import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '@packages/platform-ui';
import type {
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  PermissionEntry,
  PermissionRegistryEntry,
  BooleanPermissions,
  ListRolesParams,
} from './types';

export function createRbacApi(api: ApiFn) {
  return {
    listRoles(params: ListRolesParams): Promise<PaginatedResponse<Role>> {
      const searchParams = new URLSearchParams();

      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.search) searchParams.set('search', params.search);
      if (params.userType) searchParams.set('userType', params.userType);
      if (params.sort) searchParams.set('sort', params.sort);
      if (params.order) searchParams.set('order', params.order);

      const qs = searchParams.toString();
      return api.get<PaginatedResponse<Role>>(`/roles${qs ? `?${qs}` : ''}`);
    },

    createRole(data: CreateRoleRequest): Promise<Role> {
      return api.post<Role>('/roles', data);
    },

    updateRole(id: string, data: UpdateRoleRequest): Promise<Role> {
      return api.patch<Role>(`/roles/${id}`, data);
    },

    deleteRole(id: string): Promise<void> {
      return api.delete<void>(`/roles/${id}`);
    },

    getRoleUserCount(roleId: string): Promise<{ count: number }> {
      return api.get<{ count: number }>(`/roles/${roleId}/user-count`);
    },

    getRolePermissions(roleId: string): Promise<BooleanPermissions> {
      return api.get<BooleanPermissions>(`/roles/${roleId}/permissions`);
    },

    setRolePermissions(roleId: string, permissions: PermissionEntry[]): Promise<BooleanPermissions> {
      return api.put<BooleanPermissions>(`/roles/${roleId}/permissions`, { permissions });
    },

    getPermissionRegistry(): Promise<PermissionRegistryEntry[]> {
      return api.get<PermissionRegistryEntry[]>('/permissions/registry');
    },
  };
}

export type RbacApi = ReturnType<typeof createRbacApi>;
