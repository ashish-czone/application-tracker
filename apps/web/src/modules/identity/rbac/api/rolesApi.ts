import { api } from '../../../../lib/api';
import type { Role, CreateRoleInput, UpdateRoleInput, RolePermission } from '../types';

export function getRoles(): Promise<Role[]> {
  return api.get<Role[]>('/roles');
}

export function getRole(id: string): Promise<Role> {
  return api.get<Role>(`/roles/${id}`);
}

export function createRole(data: CreateRoleInput): Promise<Role> {
  return api.post<Role>('/roles', data);
}

export function updateRole(id: string, data: UpdateRoleInput): Promise<Role> {
  return api.patch<Role>(`/roles/${id}`, data);
}

export function deleteRole(id: string): Promise<void> {
  return api.delete(`/roles/${id}`);
}

export function getRolePermissions(roleId: string): Promise<RolePermission[]> {
  return api.get<RolePermission[]>(`/roles/${roleId}/permissions`);
}

export function setRolePermissions(roleId: string, permissionIds: string[]): Promise<RolePermission[]> {
  return api.put<RolePermission[]>(`/roles/${roleId}/permissions`, { permissionIds });
}
