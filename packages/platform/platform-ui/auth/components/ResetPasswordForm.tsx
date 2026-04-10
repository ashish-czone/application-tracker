import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, Link } from 'react-router';
import {
  Form,
  FormInput,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@packages/ui';
import { useResetPassword } from '../hooks/useResetPassword';

const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '' },
  });
  const mutation = useResetPassword();

  if (!token) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Invalid reset link</h3>
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired.
            </p>
            <Link to="/forgot-password" className="text-sm text-primary hover:underline mt-2">
              Request a new link
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  function onSubmit(data: ResetPasswordFormValues) {
    mutation.mutate({ token: token!, newPassword: data.newPassword });
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Reset password</CardTitle>
        <CardDescription>Enter your new password</CardDescription>
      </CardHeader>
      <CardContent>
        <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
          <FormInput
            name="newPassword"
            label="New password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            description="Must contain uppercase, lowercase, and a number"
          />

          {mutation.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {(mutation.error as any)?.body?.message || 'Failed to reset password. The link may have expired.'}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Resetting...' : 'Reset password'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </p>
        </Form>
      </CardContent>
    </Card>
  );
}
