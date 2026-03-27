import { useEffect, useRef } from 'react';
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
import { useCreateCategoryGroup } from '../hooks';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase kebab-case'),
  description: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddCategoryGroupFormProps {
  onClose: () => void;
}

export function AddCategoryGroupForm({ onClose }: AddCategoryGroupFormProps) {
  const slugTouched = useRef(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', description: '', sortOrder: 0 },
  });

  const nameValue = form.watch('name');

  useEffect(() => {
    if (!slugTouched.current && nameValue) {
      const slug = nameValue
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      form.setValue('slug', slug);
    }
  }, [nameValue, form]);

  const createMutation = useCreateCategoryGroup({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    createMutation.mutate({
      name: data.name,
      slug: data.slug,
      description: data.description || undefined,
      sortOrder: data.sortOrder,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Category Group</DialogTitle>
        <DialogDescription>Create a new group to organize categories.</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput name="name" label="Name" placeholder="e.g. Departments" />
        <FormInput
          name="slug"
          label="Slug"
          placeholder="e.g. departments"
        />
        <FormTextarea
          name="description"
          label="Description"
          placeholder="Optional description..."
          rows={2}
        />
        <FormInput name="sortOrder" label="Sort order" type="number" placeholder="0" />

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create category group.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create group'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
