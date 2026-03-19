import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  FormEmailInput,
  FormPhoneInput,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  useAsyncValidator,
} from '@packages/ui';
import { useUpdateUser } from '../hooks';
import { checkUnique } from '../services';
import type { User } from '../types';

const editUserSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(100),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().optional().or(z.literal('')),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserFormProps {
  user: User;
  onClose: () => void;
}

export function EditUserForm({ user, onClose }: EditUserFormProps) {
  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? '',
    },
  });

  const emailValidator = useAsyncValidator({
    checkFn: useCallback(
      (value: string) => checkUnique('users', 'email', value, user.id).then((r) => r.unique),
      [user.id],
    ),
    errorMessage: 'This email is already in use',
  });

  const updateMutation = useUpdateUser({ onSuccess: onClose });

  function onSubmit(data: EditUserFormValues) {
    updateMutation.mutate({
      id: user.id,
      data: {
        ...data,
        phone: data.phone || undefined,
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit User</DialogTitle>
        <DialogDescription>
          Update details for {user.firstName} {user.lastName}
        </DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            name="firstName"
            label="First name"
            placeholder="John"
          />
          <FormInput
            name="lastName"
            label="Last name"
            placeholder="Doe"
          />
        </div>

        <FormEmailInput
          name="email"
          label="Email"
          asyncStatus={emailValidator.status}
          asyncError={emailValidator.error ?? undefined}
          onBlurValidate={emailValidator.validate}
        />

        <FormPhoneInput
          name="phone"
          label="Phone (optional)"
          defaultCountry="AE"
        />

        {updateMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(updateMutation.error as any)?.body?.message || 'Failed to update user. Please try again.'}
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
