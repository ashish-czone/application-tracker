import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  FormSelect,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { useCreateRole } from '../hooks';

const createRoleSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  userType: z.enum(['admin', 'client'], { message: 'User type is required' }),
  isDefault: z.enum(['true', 'false']),
});

type CreateRoleFormValues = z.infer<typeof createRoleSchema>;

interface AddRoleFormProps {
  onClose: () => void;
}

export function AddRoleForm({ onClose }: AddRoleFormProps) {
  const { control, handleSubmit } = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: '',
      userType: '' as 'admin' | 'client',
      isDefault: 'false',
    },
  });

  const createMutation = useCreateRole({ onSuccess: onClose });

  function onSubmit(data: CreateRoleFormValues) {
    createMutation.mutate({
      name: data.name,
      userType: data.userType,
      isDefault: data.isDefault === 'true',
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Role</DialogTitle>
        <DialogDescription>Create a new role for user access control</DialogDescription>
      </DialogHeader>

      <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          control={control}
          name="name"
          label="Role name"
          placeholder="e.g. Manager"
          autoComplete="off"
        />

        <FormSelect
          control={control}
          name="userType"
          label="User type"
          placeholder="Select type"
          options={[
            { label: 'Admin', value: 'admin' },
            { label: 'Client', value: 'client' },
          ]}
        />

        <FormSelect
          control={control}
          name="isDefault"
          label="Default role"
          description="New users of this type will be assigned this role automatically"
          options={[
            { label: 'No', value: 'false' },
            { label: 'Yes', value: 'true' },
          ]}
        />

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create role.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create role'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
