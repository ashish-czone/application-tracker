/** Matches the tri-state produced by the backend's deriveUserStatus. */
export type UserStatus = 'active' | 'invited' | 'deactivated';

/** One org-unit membership. Attached server-side by the optional
 *  positionsReader registered in apps that have an org-units concept. */
export interface UserPosition {
  unitId: string;
  unitName: string;
  positionId: string | null;
  positionName: string | null;
}

export interface User {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  userType: 'admin' | 'client';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  lastLoginAt: string | null;
  /** Computed server-side from deletedAt + invitedAt + acceptedAt. */
  status: UserStatus;
  roles: { id: string; name: string }[];
  /** Empty array when the app has no positions reader wired up. */
  positions: UserPosition[];
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  userType: 'admin' | 'client';
  roleIds: string[];
  phone?: string;
}

export interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  userType: 'admin' | 'client';
  phone?: string;
  roleIds?: string[];
}

export interface InvitedUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  invitedAt: string;
}

export interface Role {
  id: string;
  name: string;
  userType: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  userType?: string;
  roleId?: string;
  includeDeleted?: boolean;
}
