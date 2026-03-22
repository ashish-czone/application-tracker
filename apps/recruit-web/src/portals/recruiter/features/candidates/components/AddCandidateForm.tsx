import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { DynamicField, buildFormSchema } from '@packages/eav-attributes-ui';
import { useCreateCandidate } from '../hooks';
import { useLayout } from '../../field-management/hooks';

interface AddCandidateFormProps {
  onSuccess?: (id: string) => void;
  onClose: () => void;
}

export function AddCandidateForm({ onSuccess, onClose }: AddCandidateFormProps) {
  const { data: layout, isLoading: layoutLoading } = useLayout('candidates');

  const quickCreateFields = useMemo(
    () => layout?.quickCreateFields ?? [],
    [layout],
  );

  const schema = useMemo(
    () => buildFormSchema(quickCreateFields),
    [quickCreateFields],
  );

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of quickCreateFields) {
      defaults[field.fieldKey] = field.defaultValue ?? '';
    }
    return defaults;
  }, [quickCreateFields]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const createMutation = useCreateCandidate({
    onSuccess: (candidate) => {
      onClose();
      onSuccess?.(candidate.id);
    },
  });

  function onSubmit(data: Record<string, unknown>) {
    // Coerce empty strings to undefined so they're not sent
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== '' && val !== undefined) {
        cleaned[key] = val;
      }
    }
    createMutation.mutate(cleaned);
  }

  if (layoutLoading) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      </>
    );
  }

  if (quickCreateFields.length === 0) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
          <DialogDescription>
            No quick create fields configured. Please set up quick create fields in Settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Candidate</DialogTitle>
        <DialogDescription>Quick create — you can add more details on the profile page</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {quickCreateFields.map(field => (
            <DynamicField key={field.fieldKey} field={field} mode="edit" />
          ))}
        </div>

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create candidate.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create candidate'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
