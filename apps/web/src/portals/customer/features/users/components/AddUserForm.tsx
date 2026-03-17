import { useMemo, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  FormEmailInput,
  FormPasswordInput,
  FormPhoneInput,
  FormSelect,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  useAsyncValidator,
} from '@packages/ui';
import { useCreateUser, useRoles } from '../hooks';
import { checkUnique } from '../services';

const createUserSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(100),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().optional().or(z.literal('')),
  password: z
    .string()
    .max(128)
    .refine((p) => p.length >= 8, 'At least 8 characters')
    .refine((p) => /[A-Z]/.test(p), 'Uppercase letter required')
    .refine((p) => /[a-z]/.test(p), 'Lowercase letter required')
    .refine((p) => /[0-9]/.test(p), 'Number required'),
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

  const selectedUserType = useWatch({ control, name: 'userType' });

  // Email uniqueness check
  const emailValidator = useAsyncValidator({
    checkFn: useCallback(
      (value: string) => checkUnique('users', 'email', value).then((r) => r.unique),
      [],
    ),
    errorMessage: 'This email is already in use',
  });

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

        <FormEmailInput
          control={control}
          name="email"
          label="Email"
          autoComplete="off"
          asyncStatus={emailValidator.status}
          asyncError={emailValidator.error ?? undefined}
          onBlurValidate={emailValidator.validate}
        />

        <FormPhoneInput
          control={control}
          name="phone"
          label="Phone (optional)"
          defaultCountry="AE"
        />

        <FormPasswordInput
          control={control}
          name="password"
          label="Password"
          autoComplete="new-password"
          showStrength
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
