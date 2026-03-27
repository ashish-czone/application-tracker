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
import { useUpdateTagGroup } from '../hooks';
import type { TagGroup } from '../types';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  allowMultiple: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditTagGroupFormProps {
  tagGroup: TagGroup;
  onClose: () => void;
}

export function EditTagGroupForm({ tagGroup, onClose }: EditTagGroupFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: tagGroup.name,
      description: tagGroup.description ?? '',
      allowMultiple: tagGroup.allowMultiple,
    },
  });

  const updateMutation = useUpdateTagGroup({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    updateMutation.mutate({
      id: tagGroup.id,
      data: {
        name: data.name,
        description: data.description || undefined,
        allowMultiple: data.allowMultiple,
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Tag Group</DialogTitle>
        <DialogDescription>Update "{tagGroup.name}"</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          name="name"
          label="Name"
          placeholder="e.g. Priority"
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

        {updateMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(updateMutation.error as any)?.body?.message || 'Failed to update tag group.'}
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
