export interface OrgUnitLevel {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgUnit {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  levelId: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgUnitMember {
  orgUnitId: string;
  userId: string;
  positionId: string | null;
  createdAt: Date;
}

export interface OrgUnitWithDetails extends OrgUnit {
  memberCount: number;
  level: { id: string; name: string; sortOrder: number };
  head: { userId: string; userName: string; positionName: string } | null;
  /** Top 3 members ordered by position sortOrder (for inline preview) */
  memberPreviews: OrgUnitMemberDetail[];
}

export interface OrgUnitMemberDetail {
  userId: string;
  userName: string;
  positionId: string | null;
  positionName: string | null;
}

export interface OrgPosition {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgPositionScope {
  positionId: string;
  entityType: string;
  scope: string;
}

/** Built-in scope levels for org positions */
export type PositionScopeLevel = 'all' | 'descendants' | 'unit' | 'own';

/** All built-in scope levels, ordered from most to least permissive */
export const POSITION_SCOPE_RANK: Record<string, number> = {
  all: 4,
  descendants: 3,
  unit: 2,
  own: 1,
};

/**
 * Resolves data access scope based on a user's org position.
 * Injected into entity-engine as a global provider, replacing TeamResolver.
 */
export interface PositionScopeProvider {
  /** Returns the resolved scope string for a user on a given entity type */
  resolveScope(userId: string, entityType: string): Promise<string>;
  /** Returns the user IDs visible for the given scope, or null for 'all' or custom scopes */
  resolveUserIds(userId: string, scope: string): Promise<string[] | null>;
  /** Returns the org unit IDs visible for the given scope, or null for 'all' or custom scopes */
  resolveOrgUnitIds(userId: string, scope: string): Promise<string[] | null>;
}

/** Injection token for the PositionScopeProvider */
export const POSITION_SCOPE_PROVIDER = 'POSITION_SCOPE_PROVIDER';
