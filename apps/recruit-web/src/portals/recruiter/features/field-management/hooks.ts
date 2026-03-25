import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import * as svc from './services';
import type { CreateFieldInput, UpdateFieldInput, CreateSectionInput } from './types';

export function useLayout(entityType: string) {
  return useQuery({
    queryKey: ['layout', entityType],
    queryFn: () => svc.getLayout(entityType),
    enabled: !!entityType,
  });
}

export function useLookupEntities() {
  return useQuery({
    queryKey: ['lookup-entities'],
    queryFn: () => svc.getLookupEntities(),
  });
}

function useInvalidateLayout(entityType: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['layout', entityType] });
}

export function useCreateField(entityType: string, options?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (data: CreateFieldInput) => svc.createField(entityType, data),
    onSuccess: () => { invalidate(); toast.success('Field created'); options?.onSuccess?.(); },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to create field'),
  });
}

export function useUpdateField(entityType: string, options?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFieldInput }) => svc.updateField(id, data),
    onSuccess: () => { invalidate(); toast.success('Field updated'); options?.onSuccess?.(); },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to update field'),
  });
}

export function useDeleteField(entityType: string, options?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (id: string) => svc.deleteField(id),
    onSuccess: () => { invalidate(); toast.success('Field deleted'); options?.onSuccess?.(); },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to delete field'),
  });
}

export function useCreateSection(entityType: string, options?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (data: CreateSectionInput) => svc.createSection(entityType, data),
    onSuccess: () => { invalidate(); toast.success('Section created'); options?.onSuccess?.(); },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to create section'),
  });
}

export function useUpdateSection(entityType: string, options?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSectionInput> }) =>
      svc.updateSection(entityType, id, data),
    onSuccess: () => { invalidate(); toast.success('Section updated'); options?.onSuccess?.(); },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to update section'),
  });
}

export function useDeleteSection(entityType: string, options?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (sectionId: string) => svc.deleteSection(entityType, sectionId),
    onSuccess: () => { invalidate(); toast.success('Section deleted'); options?.onSuccess?.(); },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to delete section'),
  });
}

export function useAddFieldToSection(entityType: string) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({ sectionId, fieldId, columnIndex }: { sectionId: string; fieldId: string; columnIndex?: number }) =>
      svc.addFieldToSection(entityType, sectionId, fieldId, columnIndex),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to add field'),
  });
}

export function useRemoveFieldFromSection(entityType: string) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({ sectionId, fieldId }: { sectionId: string; fieldId: string }) =>
      svc.removeFieldFromSection(entityType, sectionId, fieldId),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to remove field'),
  });
}

export function useReorderSections(entityType: string) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (orderedIds: string[]) => svc.reorderSections(entityType, orderedIds),
    onSuccess: () => invalidate(),
  });
}

export function useReorderFields(entityType: string) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: ({ sectionId, orderedFields }: { sectionId: string; orderedFields: { fieldId: string; columnIndex: number }[] }) =>
      svc.reorderFields(entityType, sectionId, orderedFields),
    onSuccess: () => invalidate(),
  });
}
