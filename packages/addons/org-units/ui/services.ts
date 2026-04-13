import type { ApiFn } from '@packages/platform-ui';
import type {
  OrgUnit,
  OrgUnitLevel,
  OrgUnitMemberDetail,
  CreateOrgUnitRequest,
  UpdateOrgUnitRequest,
  CreateOrgUnitLevelRequest,
  UpdateOrgUnitLevelRequest,
  AddMemberRequest,
  UpdateMemberPositionRequest,
  OrgPosition,
  OrgPositionScope,
  CreateOrgPositionRequest,
  UpdateOrgPositionRequest,
  SetPositionScopesRequest,
} from './types';

export function createOrgUnitsApi(api: ApiFn) {
  return {
    // ── Levels ──────────────────────────────────────────────────

    listLevels(): Promise<OrgUnitLevel[]> {
      return api.get<OrgUnitLevel[]>('/org-unit-levels');
    },

    createLevel(data: CreateOrgUnitLevelRequest): Promise<OrgUnitLevel> {
      return api.post<OrgUnitLevel>('/org-unit-levels', data);
    },

    updateLevel(id: string, data: UpdateOrgUnitLevelRequest): Promise<OrgUnitLevel> {
      return api.patch<OrgUnitLevel>(`/org-unit-levels/${id}`, data);
    },

    deleteLevel(id: string): Promise<void> {
      return api.delete<void>(`/org-unit-levels/${id}`);
    },

    // ── Org Units ───────────────────────────────────────────────

    listUnits(): Promise<OrgUnit[]> {
      return api.get<OrgUnit[]>('/org-units');
    },

    getUnit(id: string): Promise<OrgUnit> {
      return api.get<OrgUnit>(`/org-units/${id}`);
    },

    createUnit(data: CreateOrgUnitRequest): Promise<OrgUnit> {
      return api.post<OrgUnit>('/org-units', data);
    },

    updateUnit(id: string, data: UpdateOrgUnitRequest): Promise<OrgUnit> {
      return api.patch<OrgUnit>(`/org-units/${id}`, data);
    },

    deleteUnit(id: string): Promise<void> {
      return api.delete<void>(`/org-units/${id}`);
    },

    // ── Members ─────────────────────────────────────────────────

    listMembers(unitId: string): Promise<OrgUnitMemberDetail[]> {
      return api.get<OrgUnitMemberDetail[]>(`/org-units/${unitId}/members`);
    },

    addMember(unitId: string, userId: string, data?: AddMemberRequest): Promise<void> {
      return api.post<void>(`/org-units/${unitId}/members/${userId}`, data ?? {});
    },

    updateMemberPosition(unitId: string, userId: string, data: UpdateMemberPositionRequest): Promise<void> {
      return api.patch<void>(`/org-units/${unitId}/members/${userId}`, data);
    },

    removeMember(unitId: string, userId: string): Promise<void> {
      return api.delete<void>(`/org-units/${unitId}/members/${userId}`);
    },
  };
}

export type OrgUnitsApi = ReturnType<typeof createOrgUnitsApi>;
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
