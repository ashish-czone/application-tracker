import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { useCreateUser, useRoles } from '../hooks';

const createUserSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(100),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().max(20).optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
  userType: z.enum(['admin', 'client'], { message: 'User type is required' }),
  roleId: z.string().min(1, 'Role is required'),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

interface AddUserFormProps {
  onClose: () => void;
}

export function AddUserForm({ onClose }: AddUserFormProps) {
  const { control, handleSubmit, setValue } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      userType: '' as 'admin' | 'client',
      roleId: '',
    },
  });

  // Watch userType to filter roles dynamically
  const selectedUserType = useWatch({ control, name: 'userType' });

  const { data: rolesData } = useRoles(selectedUserType || undefined);

  const roleOptions = useMemo(() => {
    if (!rolesData?.data) return [];
    return rolesData.data.map((role) => ({
      label: role.name,
      value: role.id,
    }));
  }, [rolesData]);

  // Reset roleId when userType changes (selected role may not be valid for new type)
  const prevUserType = useMemo(() => selectedUserType, [selectedUserType]);
  useMemo(() => {
    if (prevUserType !== selectedUserType) {
      setValue('roleId', '');
    }
  }, [selectedUserType, prevUserType, setValue]);

  const createMutation = useCreateUser({ onSuccess: onClose });

  function onSubmit(data: CreateUserFormValues) {
    createMutation.mutate({
      ...data,
      phone: data.phone || undefined,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add User</DialogTitle>
        <DialogDescription>Create a new user account</DialogDescription>
      </DialogHeader>

      <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            control={control}
            name="firstName"
            label="First name"
            placeholder="John"
            autoComplete="off"
          />
          <FormInput
            control={control}
            name="lastName"
            label="Last name"
            placeholder="Doe"
            autoComplete="off"
          />
        </div>

        <FormInput
          control={control}
          name="email"
          label="Email"
          type="email"
          placeholder="john@example.com"
          autoComplete="off"
        />

        <FormInput
          control={control}
          name="phone"
          label="Phone (optional)"
          placeholder="+15551234567"
          autoComplete="off"
        />

        <FormInput
          control={control}
          name="password"
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
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
          name="roleId"
          label="Role"
          placeholder={selectedUserType ? 'Select role' : 'Select user type first'}
          disabled={!selectedUserType}
          options={roleOptions}
        />

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create user. Please try again.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create user'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
