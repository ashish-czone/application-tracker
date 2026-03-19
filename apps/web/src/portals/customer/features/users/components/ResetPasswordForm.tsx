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
import { useResetUserPassword } from '../hooks';
import type { User } from '../types';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  confirmPassword: z.string().min(1, 'Please confirm the password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  user: User;
  onClose: () => void;
}

export function ResetPasswordForm({ user, onClose }: ResetPasswordFormProps) {
  const { control, handleSubmit } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const resetMutation = useResetUserPassword({ onSuccess: onClose });

  function onSubmit(data: ResetPasswordFormValues) {
    resetMutation.mutate({ id: user.id, password: data.password });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogDescription>
          Set a new password for {user.firstName} {user.lastName}
        </DialogDescription>
      </DialogHeader>

      <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          control={control}
          name="password"
          label="New Password"
          type="password"
          placeholder="Enter new password"
        />
        <FormInput
          control={control}
          name="confirmPassword"
          label="Confirm Password"
          type="password"
          placeholder="Confirm new password"
        />

        {resetMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(resetMutation.error as any)?.body?.message || 'Failed to reset password.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={resetMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={resetMutation.isPending}>
            {resetMutation.isPending ? 'Updating...' : 'Update Password'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
