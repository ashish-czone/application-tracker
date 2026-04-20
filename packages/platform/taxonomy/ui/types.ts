// --- Tag Groups ---

export interface TagGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  allowMultiple: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagGroupRequest {
  name: string;
  slug: string;
  description?: string;
  allowMultiple?: boolean;
}

export interface UpdateTagGroupRequest {
  name?: string;
  description?: string;
  allowMultiple?: boolean;
}

export interface ListTagGroupsParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

// --- Tags ---

export interface Tag {
  id: string;
  tagGroupId: string;
  name: string;
  slug: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagRequest {
  name: string;
  slug: string;
  color?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
}

// --- Category Groups ---

export interface CategoryGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryGroupRequest {
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateCategoryGroupRequest {
  name?: string;
  description?: string;
  sortOrder?: number;
}

// --- Categories ---

export interface Category {
  id: string;
  groupId: string;
  parentId: string | null;
  path: string;
  depth: number;
  name: string;
  slug: string;
  sortOrder: number;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export interface CreateCategoryRequest {
  name: string;
  slug: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  sortOrder?: number;
}

export interface MoveCategoryRequest {
  parentId?: string | null;
}

// --- API Client Interface ---

export interface TaxonomyApiFn {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
}

// --- Entity Tag types (used by EntityTagsChipRow) ---

export interface EntityTag {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  tagGroupId: string;
  groupName: string;
  groupSlug: string;
}

export interface TagOption {
  value: string;
  label: string;
  color?: string;
}

/**
 * Structural ApiFn type matching @packages/platform-ui/PlatformUIProvider.
 * Duplicated here so EntityTagsChipRow can be consumed from entity-engine-ui
 * without creating a platform-ui → entity-engine-ui → taxonomy-ui cycle.
 */
export interface ApiFn {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
}
