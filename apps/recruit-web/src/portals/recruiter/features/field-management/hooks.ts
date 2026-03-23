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

export function useDeleteSection(entityType: string) {
  const invalidate = useInvalidateLayout(entityType);
  return useMutation({
    mutationFn: (sectionId: string) => svc.deleteSection(entityType, sectionId),
    onSuccess: () => { invalidate(); toast.success('Section deleted'); },
    onError: (e: any) => toast.error(e?.body?.message || 'Failed to delete section'),
  });
}

export function useAddFieldToSection(entityType: string) {
  const qc = useQueryClient();
  const key = ['layout', entityType];
  return useMutation({
    mutationFn: ({ sectionId, fieldId }: { sectionId: string; fieldId: string }) =>
      svc.addFieldToSection(entityType, sectionId, fieldId),
    onMutate: async ({ sectionId, fieldId }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<any>(key);
      if (previous) {
        const unassigned = previous.sections.find((s: any) => s.id === '__unassigned__');
        const field = unassigned?.fields?.find((f: any) => f.id === fieldId);
        if (field) {
          qc.setQueryData(key, {
            ...previous,
            sections: previous.sections.map((s: any) => {
              if (s.id === '__unassigned__') return { ...s, fields: s.fields.filter((f: any) => f.id !== fieldId) };
              if (s.id === sectionId) return { ...s, fields: [...s.fields, field] };
              return s;
            }),
          });
        }
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast.error('Failed to add field');
    },
    onSettled: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: key }), 1500);
    },
  });
}

export function useRemoveFieldFromSection(entityType: string) {
  const qc = useQueryClient();
  const key = ['layout', entityType];
  return useMutation({
    mutationFn: ({ sectionId, fieldId }: { sectionId: string; fieldId: string }) =>
      svc.removeFieldFromSection(entityType, sectionId, fieldId),
    onMutate: async ({ sectionId, fieldId }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<any>(key);
      if (previous) {
        const section = previous.sections.find((s: any) => s.id === sectionId);
        const field = section?.fields?.find((f: any) => f.id === fieldId);
        if (field) {
          qc.setQueryData(key, {
            ...previous,
            sections: previous.sections.map((s: any) => {
              if (s.id === sectionId) return { ...s, fields: s.fields.filter((f: any) => f.id !== fieldId) };
              if (s.id === '__unassigned__') return { ...s, fields: [...s.fields, field] };
              return s;
            }),
          });
        }
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast.error('Failed to remove field');
    },
    onSettled: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: key }), 1500);
    },
  });
}

export function useReorderSections(entityType: string) {
  const qc = useQueryClient();
  const key = ['layout', entityType];
  return useMutation({
    mutationFn: (orderedIds: string[]) => svc.reorderSections(entityType, orderedIds),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<any>(key);
      if (previous) {
        const sectionMap = new Map(previous.sections.map((s: any) => [s.id, s]));
        qc.setQueryData(key, {
          ...previous,
          sections: orderedIds.map((id: string) => sectionMap.get(id)).filter(Boolean),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: key }), 1500);
    },
  });
}

export function useReorderFields(entityType: string) {
  const qc = useQueryClient();
  const key = ['layout', entityType];
  return useMutation({
    mutationFn: ({ sectionId, orderedFieldIds }: { sectionId: string; orderedFieldIds: string[] }) =>
      svc.reorderFields(entityType, sectionId, orderedFieldIds),
    onMutate: async ({ sectionId, orderedFieldIds }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<any>(key);
      if (previous) {
        qc.setQueryData(key, {
          ...previous,
          sections: previous.sections.map((s: any) => {
            if (s.id !== sectionId) return s;
            const fieldMap = new Map(s.fields.map((f: any) => [f.id, f]));
            return { ...s, fields: orderedFieldIds.map((id: string) => fieldMap.get(id)).filter(Boolean) };
          }),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: key }), 1500);
    },
  });
}
