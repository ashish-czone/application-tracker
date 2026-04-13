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
import { useUpdateRole } from '../hooks';
import type { Role } from '../types';

const editRoleSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

type EditRoleFormValues = z.infer<typeof editRoleSchema>;

interface EditRoleFormProps {
  role: Role;
  onClose: () => void;
}

export function EditRoleForm({ role, onClose }: EditRoleFormProps) {
  const form = useForm<EditRoleFormValues>({
    resolver: zodResolver(editRoleSchema),
    defaultValues: { name: role.name },
  });

  const updateMutation = useUpdateRole({ onSuccess: onClose });

  function onSubmit(data: EditRoleFormValues) {
    updateMutation.mutate({ id: role.id, data });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Role</DialogTitle>
        <DialogDescription>Update the name for "{role.name}"</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          name="name"
          label="Role name"
          placeholder="e.g. Manager"
        />

        {updateMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(updateMutation.error as any)?.body?.message || 'Failed to update role.'}
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
