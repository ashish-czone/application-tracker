import type { PaginatedResponse } from '@packages/common';
import type {
  TaxonomyApiFn,
  TagGroup,
  Tag,
  CreateTagGroupRequest,
  UpdateTagGroupRequest,
  ListTagGroupsParams,
  CreateTagRequest,
  UpdateTagRequest,
  CategoryGroup,
  CategoryTreeNode,
  Category,
  CreateCategoryGroupRequest,
  UpdateCategoryGroupRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  MoveCategoryRequest,
} from './types';

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

// --- Tag Group Services ---

export function listTagGroups(api: TaxonomyApiFn, params: ListTagGroupsParams): Promise<PaginatedResponse<TagGroup>> {
  return api.get<PaginatedResponse<TagGroup>>(`/tag-groups${buildQueryString(params as Record<string, unknown>)}`);
}

export function getTagGroup(api: TaxonomyApiFn, id: string): Promise<TagGroup> {
  return api.get<TagGroup>(`/tag-groups/${id}`);
}

export function createTagGroup(api: TaxonomyApiFn, data: CreateTagGroupRequest): Promise<TagGroup> {
  return api.post<TagGroup>('/tag-groups', data);
}

export function updateTagGroup(api: TaxonomyApiFn, id: string, data: UpdateTagGroupRequest): Promise<TagGroup> {
  return api.patch<TagGroup>(`/tag-groups/${id}`, data);
}

export function deleteTagGroup(api: TaxonomyApiFn, id: string): Promise<void> {
  return api.delete<void>(`/tag-groups/${id}`);
}

// --- Tag Services ---

export function listTagsByGroup(api: TaxonomyApiFn, groupId: string): Promise<Tag[]> {
  return api.get<Tag[]>(`/tag-groups/${groupId}/tags`);
}

export function getTag(api: TaxonomyApiFn, id: string): Promise<Tag> {
  return api.get<Tag>(`/tags/${id}`);
}

export function createTag(api: TaxonomyApiFn, groupId: string, data: CreateTagRequest): Promise<Tag> {
  return api.post<Tag>(`/tag-groups/${groupId}/tags`, data);
}

export function updateTag(api: TaxonomyApiFn, id: string, data: UpdateTagRequest): Promise<Tag> {
  return api.patch<Tag>(`/tags/${id}`, data);
}

export function deleteTag(api: TaxonomyApiFn, id: string): Promise<void> {
  return api.delete<void>(`/tags/${id}`);
}

// --- Category Group Services ---

export function listCategoryGroups(api: TaxonomyApiFn): Promise<CategoryGroup[]> {
  return api.get<CategoryGroup[]>('/category-groups');
}

export function getCategoryGroup(api: TaxonomyApiFn, id: string): Promise<CategoryGroup> {
  return api.get<CategoryGroup>(`/category-groups/${id}`);
}

export function createCategoryGroup(api: TaxonomyApiFn, data: CreateCategoryGroupRequest): Promise<CategoryGroup> {
  return api.post<CategoryGroup>('/category-groups', data);
}

export function updateCategoryGroup(api: TaxonomyApiFn, id: string, data: UpdateCategoryGroupRequest): Promise<CategoryGroup> {
  return api.patch<CategoryGroup>(`/category-groups/${id}`, data);
}

export function deleteCategoryGroup(api: TaxonomyApiFn, id: string): Promise<void> {
  return api.delete<void>(`/category-groups/${id}`);
}

// --- Category Services ---

export function getCategoryTree(api: TaxonomyApiFn, groupId: string): Promise<CategoryTreeNode[]> {
  return api.get<CategoryTreeNode[]>(`/category-groups/${groupId}/tree`);
}

export function getCategory(api: TaxonomyApiFn, id: string): Promise<Category> {
  return api.get<Category>(`/categories/${id}`);
}

export function getCategoryAncestors(api: TaxonomyApiFn, id: string): Promise<Category[]> {
  return api.get<Category[]>(`/categories/${id}/ancestors`);
}

export function createCategory(api: TaxonomyApiFn, groupId: string, data: CreateCategoryRequest): Promise<Category> {
  return api.post<Category>(`/category-groups/${groupId}/categories`, data);
}

export function updateCategory(api: TaxonomyApiFn, id: string, data: UpdateCategoryRequest): Promise<Category> {
  return api.patch<Category>(`/categories/${id}`, data);
}

export function moveCategory(api: TaxonomyApiFn, id: string, data: MoveCategoryRequest): Promise<Category> {
  return api.patch<Category>(`/categories/${id}/move`, data);
}

export function deleteCategory(api: TaxonomyApiFn, id: string): Promise<void> {
  return api.delete<void>(`/categories/${id}`);
}

// --- Entity Tag Services (apiFn-based, used by EntityTagsChipRow) ---

import type { ApiFn, EntityTag, TagOption } from './types';

export function createEntityTaxonomyApi(api: ApiFn) {
  return {
    getEntityTags(entityType: string, entityId: string): Promise<EntityTag[]> {
      return api.get<EntityTag[]>(`/entities/${entityType}/${entityId}/tags`);
    },

    setEntityTags(
      entityType: string,
      entityId: string,
      groupSlug: string,
      tagIds: string[],
    ): Promise<EntityTag[]> {
      return api.put<EntityTag[]>(`/entities/${entityType}/${entityId}/tags`, {
        groupSlug,
        tagIds,
      });
    },

    searchTagOptions(groupSlug: string, search?: string, limit = 20): Promise<TagOption[]> {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      qs.set('limit', String(limit));
      return api.get<TagOption[]>(`/tags/group/${groupSlug}?${qs.toString()}`);
    },
  };
}

export type EntityTaxonomyApi = ReturnType<typeof createEntityTaxonomyApi>;
