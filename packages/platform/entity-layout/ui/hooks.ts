import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import type { CreateFieldInput, UpdateFieldInput, CreateSectionInput } from '@packages/eav-attributes-ui';
import { createFieldManagementApi, type FieldManagementApi } from './services';

export function useFieldManagementApi(): FieldManagementApi {
  const apiFn = usePlatformAPI();
  return useMemo(() => createFieldManagementApi(apiFn), [apiFn]);
}

export function useLayout(entityType: string) {
  const api = useFieldManagementApi();
  return useQuery({
    queryKey: ['layout', entityType],
    queryFn: () => api.getLayout(entityType),
    enabled: !!entityType,
  });
}

export function useFieldTypes() {
  const api = useFieldManagementApi();
  return useQuery({
    queryKey: ['field-types'],
    queryFn: () => api.getFieldTypes(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLookupEntities() {
  const api = useFieldManagementApi();
  return useQuery({
    queryKey: ['lookup-entities'],
    queryFn: () => api.getLookupEntities(),
  });
}

export function useTagGroupSlugs() {
  const api = useFieldManagementApi();
  return useQuery({
    queryKey: ['tag-group-slugs'],
    queryFn: () => api.getTagGroupSlugs(),
  });
}

export function useCategoryGroupSlugs() {
  const api = useFieldManagementApi();
  return useQuery({
    queryKey: ['category-group-slugs'],
    queryFn: () => api.getCategoryGroupSlugs(),
  });
}

function useInvalidateLayout(entityType: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['layout', entityType] });
}

export function useCreateField(entityType: string, options?: { onSuccess?: () => void }) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (data: CreateFieldInput) => api.createField(entityType, data),
    onSuccess: () => {
      invalidate();
      toast.success('Field created');
      options?.onSuccess?.();
    },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to create field'),
  });
}

export function useUpdateField(entityType: string, options?: { onSuccess?: () => void }) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFieldInput }) => api.updateField(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Field updated');
      options?.onSuccess?.();
    },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to update field'),
  });
}

export function useDeleteField(entityType: string, options?: { onSuccess?: () => void }) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (id: string) => api.deleteField(id),
    onSuccess: () => {
      invalidate();
      toast.success('Field deleted');
      options?.onSuccess?.();
    },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to delete field'),
  });
}

export function useCreateSection(entityType: string, options?: { onSuccess?: () => void }) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (data: CreateSectionInput) => api.createSection(entityType, data),
    onSuccess: () => {
      invalidate();
      toast.success('Section created');
      options?.onSuccess?.();
    },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to create section'),
  });
}

export function useUpdateSection(entityType: string, options?: { onSuccess?: () => void }) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSectionInput> }) =>
      api.updateSection(entityType, id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Section updated');
      options?.onSuccess?.();
    },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to update section'),
  });
}

export function useDeleteSection(entityType: string, options?: { onSuccess?: () => void }) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (sectionId: string) => api.deleteSection(entityType, sectionId),
    onSuccess: () => {
      invalidate();
      toast.success('Section deleted');
      options?.onSuccess?.();
    },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to delete section'),
  });
}

export function useAddFieldToSection(entityType: string) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({
      sectionId,
      fieldId,
      columnIndex,
    }: {
      sectionId: string;
      fieldId: string;
      columnIndex?: number;
    }) => api.addFieldToSection(entityType, sectionId, fieldId, columnIndex),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to add field'),
  });
}

export function useRemoveFieldFromSection(entityType: string) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({ sectionId, fieldId }: { sectionId: string; fieldId: string }) =>
      api.removeFieldFromSection(entityType, sectionId, fieldId),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to remove field'),
  });
}

export function useReorderSections(entityType: string) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderSections(entityType, orderedIds),
    onSuccess: () => invalidate(),
  });
}

export function useReorderFields(entityType: string) {
  const api = useFieldManagementApi();
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({
      sectionId,
      orderedFields,
    }: {
      sectionId: string;
      orderedFields: { fieldId: string; columnIndex: number }[];
    }) => api.reorderFields(entityType, sectionId, orderedFields),
    onSuccess: () => invalidate(),
  });
}
