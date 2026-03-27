import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  FormTextarea,
  FormCheckbox,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { useCreateTagGroup } from '../hooks';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase kebab-case'),
  description: z.string().max(500).optional(),
  allowMultiple: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddTagGroupFormProps {
  onClose: () => void;
}

export function AddTagGroupForm({ onClose }: AddTagGroupFormProps) {
  const slugTouched = useRef(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', description: '', allowMultiple: true },
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

  const createMutation = useCreateTagGroup({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    createMutation.mutate({
      name: data.name,
      slug: data.slug,
      description: data.description || undefined,
      allowMultiple: data.allowMultiple,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Tag Group</DialogTitle>
        <DialogDescription>Create a new group to organize related tags.</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          name="name"
          label="Name"
          placeholder="e.g. Priority"
        />
        <FormInput
          name="slug"
          label="Slug"
          placeholder="e.g. priority"
        />
        <FormTextarea
          name="description"
          label="Description"
          placeholder="Optional description..."
          rows={2}
        />
        <FormCheckbox
          name="allowMultiple"
          label="Allow multiple tags from this group per entity"
        />

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create tag group.'}
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
