export interface OrgPosition {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgPositionScope {
  positionId: string;
  entityType: string;
  scope: string;
}

export interface CreateOrgPositionRequest {
  name: string;
  sortOrder?: number;
}

export interface UpdateOrgPositionRequest {
  name?: string;
  sortOrder?: number;
}

export interface SetPositionScopesRequest {
  scopes: { entityType: string; scope: string }[];
}
