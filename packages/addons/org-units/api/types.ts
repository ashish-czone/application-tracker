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

/**
 * Expands a hierarchical access scope (`unit` / `descendants`) into the set
 * of user-ids and org-unit-ids it covers for a given actor. Authorisation
 * rules themselves live on role-permission grants; this provider only
 * supplies tree-shape data the enforcement layer asks for.
 *
 * Returns `null` for scope keys that don't map to tree traversal (e.g. `own`,
 * `assigned`, custom keys) so the caller can fall through.
 */
export interface PositionScopeProvider {
  resolveUserIds(userId: string, scope: string): Promise<string[] | null>;
  resolveOrgUnitIds(userId: string, scope: string): Promise<string[] | null>;
}

/** Injection token for the PositionScopeProvider */
export const POSITION_SCOPE_PROVIDER = 'POSITION_SCOPE_PROVIDER';
