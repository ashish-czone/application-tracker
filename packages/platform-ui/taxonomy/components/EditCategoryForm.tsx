import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { useUpdateCategory } from '../hooks';
import type { Category } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase kebab-case'),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditCategoryFormProps {
  category: Category;
  onClose: () => void;
}

export function EditCategoryForm({ category, onClose }: EditCategoryFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
    },
  });

  const updateMutation = useUpdateCategory({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    updateMutation.mutate({
      id: category.id,
      data: {
        name: data.name,
        slug: data.slug,
        sortOrder: data.sortOrder,
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Category</DialogTitle>
        <DialogDescription>Update "{category.name}"</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput name="name" label="Name" placeholder="e.g. Engineering" />
        <FormInput name="slug" label="Slug" placeholder="e.g. engineering" />
        <FormInput name="sortOrder" label="Sort order" type="number" placeholder="0" />

        {updateMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(updateMutation.error as any)?.body?.message || 'Failed to update category.'}
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
