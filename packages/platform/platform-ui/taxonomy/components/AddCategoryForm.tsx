import { useEffect, useRef } from 'react';
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
import { useCreateCategory } from '../hooks';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase kebab-case'),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddCategoryFormProps {
  groupId: string;
  parentId?: string;
  parentName?: string;
  onClose: () => void;
}

export function AddCategoryForm({ groupId, parentId, parentName, onClose }: AddCategoryFormProps) {
  const slugTouched = useRef(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', sortOrder: 0 },
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

  const createMutation = useCreateCategory({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    createMutation.mutate({
      groupId,
      data: {
        name: data.name,
        slug: data.slug,
        parentId,
        sortOrder: data.sortOrder,
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Category</DialogTitle>
        <DialogDescription>
          {parentName
            ? `Add a subcategory under "${parentName}".`
            : 'Add a root-level category.'
          }
        </DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput name="name" label="Name" placeholder="e.g. Engineering" />
        <FormInput name="slug" label="Slug" placeholder="e.g. engineering" />
        <FormInput name="sortOrder" label="Sort order" type="number" placeholder="0" />

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create category.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create category'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
