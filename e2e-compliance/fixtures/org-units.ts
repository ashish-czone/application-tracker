import { apiClient } from '../helpers/api-client';
import { uniqueName } from '../helpers/unique-name';

export interface OrgUnitLevel {
  id: string;
  name: string;
}

export interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
  levelId: string;
  memberCount?: number;
}

export type DefaultLevelName = 'Company' | 'Entity' | 'Division' | 'Team';

export async function getOrgUnitLevel(name: DefaultLevelName): Promise<OrgUnitLevel> {
  const levels = await apiClient.get<OrgUnitLevel[]>('/org-unit-levels');
  const level = levels.find((l) => l.name === name);
  if (!level) {
    throw new Error(
      `Org-unit level "${name}" not found. Has resetState() run, and is org-units in the system seed list?`,
    );
  }
  return level;
}

export interface CreateOrgUnitOverrides {
  name?: string;
  parentId?: string | null;
  levelId?: string;
  level?: DefaultLevelName;
}

export async function createOrgUnit(overrides: CreateOrgUnitOverrides = {}): Promise<OrgUnit> {
  let levelId = overrides.levelId;
  if (!levelId) {
    const level = await getOrgUnitLevel(overrides.level ?? 'Team');
    levelId = level.id;
  }
  return apiClient.post<OrgUnit>('/org-units', {
    name: overrides.name ?? uniqueName('Team'),
    parentId: overrides.parentId ?? null,
    levelId,
  });
}

export async function addUserToOrgUnit(unitId: string, userId: string): Promise<void> {
  await apiClient.post(`/org-units/${unitId}/members/${userId}`, {});
}
