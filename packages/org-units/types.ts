export interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
  type: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgUnitMember {
  orgUnitId: string;
  userId: string;
  createdAt: Date;
}

export interface OrgUnitWithMembers extends OrgUnit {
  memberCount: number;
}
