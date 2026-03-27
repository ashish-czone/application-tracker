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
import { useUpdateTag } from '../hooks';
import type { Tag } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  color: z.string().max(20).optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditTagFormProps {
  tag: Tag;
  onClose: () => void;
}

export function EditTagForm({ tag, onClose }: EditTagFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: tag.name,
      color: tag.color ?? '#6366f1',
    },
  });

  const updateMutation = useUpdateTag({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    updateMutation.mutate({
      id: tag.id,
      data: {
        name: data.name,
        color: data.color || undefined,
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Tag</DialogTitle>
        <DialogDescription>Update "{tag.name}"</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          name="name"
          label="Name"
          placeholder="e.g. High"
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

        {updateMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(updateMutation.error as any)?.body?.message || 'Failed to update tag.'}
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
