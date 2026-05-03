import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '@packages/platform-ui';
import type {
  Role,
  RoleMember,
  RoleOption,
  CreateRoleRequest,
  UpdateRoleRequest,
  PermissionEntry,
  PermissionManifest,
  BooleanPermissions,
  ListRolesParams,
  ListRoleMembersParams,
  RoleOptionsParams,
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

    listPermissionManifests(): Promise<PermissionManifest[]> {
      return api.get<PermissionManifest[]>('/permission-manifests');
    },

    listRoleMembers(roleId: string, params: ListRoleMembersParams): Promise<PaginatedResponse<RoleMember>> {
      const searchParams = new URLSearchParams();
      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.search) searchParams.set('search', params.search);
      const qs = searchParams.toString();
      return api.get<PaginatedResponse<RoleMember>>(`/roles/${roleId}/members${qs ? `?${qs}` : ''}`);
    },

    listRoleOptions(params: RoleOptionsParams): Promise<RoleOption[]> {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.set('search', params.search);
      if (params.ids && params.ids.length > 0) {
        // Sort + dedupe so query keys are stable regardless of input ordering.
        const ids = [...new Set(params.ids)].sort();
        searchParams.set('ids', ids.join(','));
      }
      if (params.limit != null) searchParams.set('limit', String(params.limit));
      if (params.userType) searchParams.set('userType', params.userType);
      const qs = searchParams.toString();
      return api.get<RoleOption[]>(`/roles/options${qs ? `?${qs}` : ''}`);
    },

    addRoleMember(roleId: string, userId: string): Promise<RoleMember> {
      return api.post<RoleMember>(`/roles/${roleId}/members`, { userId });
    },

    removeRoleMember(roleId: string, userId: string): Promise<void> {
      return api.delete<void>(`/roles/${roleId}/members/${userId}`);
    },
  };
}

export type RbacApi = ReturnType<typeof createRbacApi>;
