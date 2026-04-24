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

