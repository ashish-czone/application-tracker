export interface User {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  userType: 'admin' | 'client';
  createdAt: string;
  updatedAt: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  userType?: string;
}
