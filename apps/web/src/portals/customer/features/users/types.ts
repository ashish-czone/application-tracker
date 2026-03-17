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
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  userType: 'admin' | 'client';
  roleId: string;
  phone?: string;
}

export interface Role {
  id: string;
  name: string;
  userType: string;
  isDefault: boolean;
  isSuperadmin: boolean;
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
  includeDeleted?: boolean;
}
