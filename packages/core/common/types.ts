export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  data: T;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PAGE_SIZE = 25;
