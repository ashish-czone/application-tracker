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
import { useCreateTag } from '../hooks';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase kebab-case'),
  color: z.string().max(20).optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddTagFormProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
}

export function AddTagForm({ groupId, groupName, onClose }: AddTagFormProps) {
  const slugTouched = useRef(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', color: '#6366f1' },
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

  const createMutation = useCreateTag({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    createMutation.mutate({
      groupId,
      data: {
        name: data.name,
        slug: data.slug,
        color: data.color || undefined,
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Tag</DialogTitle>
        <DialogDescription>Add a new tag to "{groupName}".</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          name="name"
          label="Name"
          placeholder="e.g. High"
        />
        <FormInput
          name="slug"
          label="Slug"
          placeholder="e.g. high"
        />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.watch('color') || '#6366f1'}
              onChange={(e) => form.setValue('color', e.target.value)}
              className="h-9 w-9 rounded-md border border-input cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">{form.watch('color')}</span>
          </div>
        </div>

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create tag.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create tag'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
