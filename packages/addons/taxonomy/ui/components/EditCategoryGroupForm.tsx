import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  FormTextarea,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { useUpdateCategoryGroup } from '../hooks';
import type { CategoryGroup } from '../types';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditCategoryGroupFormProps {
  categoryGroup: CategoryGroup;
  onClose: () => void;
}

export function EditCategoryGroupForm({ categoryGroup, onClose }: EditCategoryGroupFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: categoryGroup.name,
      description: categoryGroup.description ?? '',
      sortOrder: categoryGroup.sortOrder,
    },
  });

  const updateMutation = useUpdateCategoryGroup({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    updateMutation.mutate({
      id: categoryGroup.id,
      data: {
        name: data.name,
        description: data.description || undefined,
        sortOrder: data.sortOrder,
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Category Group</DialogTitle>
        <DialogDescription>Update "{categoryGroup.name}"</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput name="name" label="Name" placeholder="e.g. Departments" />
        <FormTextarea
          name="description"
          label="Description"
          placeholder="Optional description..."
          rows={2}
        />
        <FormInput name="sortOrder" label="Sort order" type="number" placeholder="0" />

        {updateMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(updateMutation.error as any)?.body?.message || 'Failed to update category group.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
