import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useTaxonomyApi } from './TaxonomyProvider';
import {
  listTagGroups,
  createTagGroup,
  updateTagGroup,
  deleteTagGroup,
  listTagsByGroup,
  createTag,
  updateTag,
  deleteTag,
  listCategoryGroups,
  createCategoryGroup,
  updateCategoryGroup,
  deleteCategoryGroup,
  getCategoryTree,
  createCategory,
  updateCategory,
  moveCategory,
  deleteCategory,
} from './services';
import type {
  ListTagGroupsParams,
  CreateTagGroupRequest,
  UpdateTagGroupRequest,
  CreateTagRequest,
  UpdateTagRequest,
  CreateCategoryGroupRequest,
  UpdateCategoryGroupRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  MoveCategoryRequest,
} from './types';

// --- Tag Group Hooks ---

export function useTagGroupsList(params: ListTagGroupsParams) {
  const api = useTaxonomyApi();
  return useQuery({
    queryKey: ['tag-groups', params],
    queryFn: () => listTagGroups(api, params),
  });
}

export function useCreateTagGroup(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagGroupRequest) => createTagGroup(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-groups'] });
      toast.success('Tag group created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create tag group');
    },
  });
}

export function useUpdateTagGroup(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagGroupRequest }) => updateTagGroup(api, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-groups'] });
      toast.success('Tag group updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update tag group');
    },
  });
}

export function useDeleteTagGroup(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTagGroup(api, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-groups'] });
      toast.success('Tag group deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete tag group');
    },
  });
}

// --- Tag Hooks ---

export function useTagsByGroup(groupId: string | null) {
  const api = useTaxonomyApi();
  return useQuery({
    queryKey: ['tags', groupId],
    queryFn: () => listTagsByGroup(api, groupId!),
    enabled: !!groupId,
  });
}

export function useCreateTag(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: CreateTagRequest }) => createTag(api, groupId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.groupId] });
      toast.success('Tag created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create tag');
    },
  });
}

export function useUpdateTag(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagRequest }) => updateTag(api, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update tag');
    },
  });
}

export function useDeleteTag(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTag(api, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete tag');
    },
  });
}

// --- Category Group Hooks ---

export function useCategoryGroupsList() {
  const api = useTaxonomyApi();
  return useQuery({
    queryKey: ['category-groups'],
    queryFn: () => listCategoryGroups(api),
  });
}

export function useCreateCategoryGroup(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryGroupRequest) => createCategoryGroup(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-groups'] });
      toast.success('Category group created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create category group');
    },
  });
}

export function useUpdateCategoryGroup(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryGroupRequest }) => updateCategoryGroup(api, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-groups'] });
      toast.success('Category group updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update category group');
    },
  });
}

export function useDeleteCategoryGroup(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategoryGroup(api, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-groups'] });
      toast.success('Category group deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete category group');
    },
  });
}

// --- Category Hooks ---

export function useCategoryTree(groupId: string | null) {
  const api = useTaxonomyApi();
  return useQuery({
    queryKey: ['category-tree', groupId],
    queryFn: () => getCategoryTree(api, groupId!),
    enabled: !!groupId,
  });
}

export function useCreateCategory(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: CreateCategoryRequest }) => createCategory(api, groupId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['category-tree', variables.groupId] });
      toast.success('Category created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create category');
    },
  });
}

export function useUpdateCategory(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryRequest }) => updateCategory(api, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-tree'] });
      toast.success('Category updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update category');
    },
  });
}

export function useMoveCategory(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MoveCategoryRequest }) => moveCategory(api, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-tree'] });
      toast.success('Category moved');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to move category');
    },
  });
}

export function useDeleteCategory(options?: { onSuccess?: () => void }) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(api, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-tree'] });
      toast.success('Category deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete category');
    },
  });
}
