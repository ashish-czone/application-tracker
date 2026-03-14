import { api } from '../../../../lib/api';
import type { Permission, RegisteredResource } from '../types';

export function getPermissions(): Promise<Permission[]> {
  return api.get<Permission[]>('/permissions');
}

export function getPermissionRegistry(): Promise<RegisteredResource[]> {
  return api.get<RegisteredResource[]>('/permissions/registry');
}
