import { useState, useCallback, useEffect } from 'react';
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
  Label,
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
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

interface AddUserFormProps {
  onClose: () => void;
}

export function AddUserForm({ onClose }: AddUserFormProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [rolesError, setRolesError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      userType: '' as 'admin' | 'client',
    },
  });

  const selectedUserType = useWatch({ control, name: 'userType' });

  const emailValidator = useAsyncValidator({
    checkFn: useCallback(
      (value: string) => checkUnique('users', 'email', value).then((r) => r.unique),
      [],
    ),
    errorMessage: 'This email is already in use',
  });

  const { data: rolesData } = useRoles(selectedUserType || undefined);

  // Reset selected roles when userType changes
  useEffect(() => {
    setSelectedRoleIds(new Set());
    setRolesError(null);
  }, [selectedUserType]);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
    setRolesError(null);
  }

  const createMutation = useCreateUser({ onSuccess: onClose });

  function onSubmit(data: CreateUserFormValues) {
    if (selectedRoleIds.size === 0) {
      setRolesError('Select at least one role');
      return;
    }
    createMutation.mutate({
      ...data,
      phone: data.phone || undefined,
      roleIds: Array.from(selectedRoleIds),
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

        {/* Multi-select roles as checkboxes */}
        <div className="space-y-2">
          <Label>{selectedUserType ? 'Roles' : 'Roles (select user type first)'}</Label>
          {!selectedUserType ? (
            <p className="text-sm text-muted-foreground">Select a user type to see available roles</p>
          ) : !rolesData?.data?.length ? (
            <p className="text-sm text-muted-foreground">No roles available for this user type</p>
          ) : (
            <div className="space-y-1 rounded-md border border-input p-2">
              {rolesData.data.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.has(role.id)}
                    onChange={() => toggleRole(role.id)}
                    className="rounded border-input"
                  />
                  <span className="text-foreground">{role.name}</span>
                  {role.isSuperadmin && (
                    <span className="text-[10px] text-muted-foreground">(Superadmin)</span>
                  )}
                </label>
              ))}
            </div>
          )}
          {rolesError && (
            <p className="text-sm text-destructive" aria-live="polite">{rolesError}</p>
          )}
        </div>

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
