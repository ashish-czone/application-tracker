import type { ApiFn } from '../PlatformUIProvider';
import type {
  OrgPosition,
  OrgPositionScope,
  CreateOrgPositionRequest,
  UpdateOrgPositionRequest,
  SetPositionScopesRequest,
} from './types';

export function createOrgPositionsApi(api: ApiFn) {
  return {
    list(): Promise<OrgPosition[]> {
      return api.get<OrgPosition[]>('/org-positions');
    },

    get(id: string): Promise<OrgPosition> {
      return api.get<OrgPosition>(`/org-positions/${id}`);
    },

    create(data: CreateOrgPositionRequest): Promise<OrgPosition> {
      return api.post<OrgPosition>('/org-positions', data);
    },

    update(id: string, data: UpdateOrgPositionRequest): Promise<OrgPosition> {
      return api.patch<OrgPosition>(`/org-positions/${id}`, data);
    },

    delete(id: string): Promise<void> {
      return api.delete<void>(`/org-positions/${id}`);
    },

    getScopes(positionId: string): Promise<OrgPositionScope[]> {
      return api.get<OrgPositionScope[]>(`/org-positions/${positionId}/scopes`);
    },

    setScopes(positionId: string, data: SetPositionScopesRequest): Promise<OrgPositionScope[]> {
      return api.put<OrgPositionScope[]>(`/org-positions/${positionId}/scopes`, data);
    },
  };
}

export type OrgPositionsApi = ReturnType<typeof createOrgPositionsApi>;
