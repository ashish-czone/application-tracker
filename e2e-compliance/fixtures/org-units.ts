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

export async function addUserToOrgUnit(
  unitId: string,
  userId: string,
  options: { positionId?: string } = {},
): Promise<void> {
  await apiClient.post(`/org-units/${unitId}/members/${userId}`, options.positionId ? { positionId: options.positionId } : {});
}

export interface OrgPosition {
  id: string;
  name: string;
  sortOrder: number;
}

/**
 * Look up a seeded position by name. The system seeds ship five canonical
 * positions — `Firm Admin` (sortOrder -1), `Head` and `Division Head`
 * (sortOrder 0), `Lead` (1), `Member` (2). The `org_unit_head` resolver
 * picks the lowest-sortOrder member as "head" of a unit, so adding a user
 * with `Head` (or `Firm Admin`) makes them the resolver-resolved head.
 */
export async function getOrgPosition(name: string): Promise<OrgPosition> {
  const positions = await apiClient.get<OrgPosition[]>('/org-positions');
  const position = positions.find((p) => p.name === name);
  if (!position) {
    throw new Error(`Org position "${name}" not found. Has resetState() run?`);
  }
  return position;
}
