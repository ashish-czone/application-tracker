export interface PageRecord {
  id: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  ogImage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SectionRecord {
  id: string;
  pageId: string;
  order: number;
  blockKind: string;
  variant: string | null;
  title: string | null;
  dataSource: unknown | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePageInput {
  slug: string;
  title: string;
  metaDescription?: string;
  ogImage?: string;
}

export interface UpdatePageInput {
  slug?: string;
  title?: string;
  metaDescription?: string | null;
  ogImage?: string | null;
}

export interface CreateSectionInput {
  pageId: string;
  order: number;
  blockKind: string;
  variant?: string | null;
  title?: string | null;
  dataSource?: unknown | null;
  customFields?: Record<string, unknown>;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
