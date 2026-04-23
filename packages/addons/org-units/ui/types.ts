export interface OrgUnitLevel {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgUnitHead {
  userId: string;
  userName: string;
  positionName: string;
}

export interface OrgUnit {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  levelId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  level: { id: string; name: string; sortOrder: number };
  head: OrgUnitHead | null;
  memberPreviews: OrgUnitMemberDetail[];
}

export interface OrgUnitMemberDetail {
  userId: string;
  userName: string;
  positionId: string | null;
  positionName: string | null;
}

export interface CreateOrgUnitRequest {
  name: string;
  description?: string;
  levelId: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateOrgUnitRequest {
  name?: string;
  description?: string | null;
  levelId?: string;
  parentId?: string | null;
  sortOrder?: number;
}

export interface CreateOrgUnitLevelRequest {
  name: string;
  sortOrder?: number;
}

export interface UpdateOrgUnitLevelRequest {
  name?: string;
  sortOrder?: number;
}

export interface AddMemberRequest {
  positionId?: string;
}

export interface UpdateMemberPositionRequest {
  positionId: string | null;
}

export interface OrgPosition {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrgPositionRequest {
  name: string;
  sortOrder?: number;
}

export interface UpdateOrgPositionRequest {
  name?: string;
  sortOrder?: number;
}
