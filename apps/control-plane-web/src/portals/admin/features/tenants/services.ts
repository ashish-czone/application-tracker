import { api } from '../../../../lib/api';
import type { Tenant, UpdateTenantInput } from './types';

export const tenantApi = {
  list: () => api.get<Tenant[]>('/tenants'),
  get: (id: string) => api.get<Tenant>(`/tenants/${id}`),
  create: (data: Partial<Tenant>) => api.post<Tenant>('/tenants', data),
  update: (id: string, data: UpdateTenantInput) => api.patch<Tenant>(`/tenants/${id}`, data),
};
