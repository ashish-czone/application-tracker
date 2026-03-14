import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, FormInput } from '@packages/ui';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '../schemas/forgotPasswordSchema';
import type { ReactNode } from 'react';

interface ForgotPasswordFormProps {
  onSubmit: (data: ForgotPasswordFormValues) => void;
  isLoading: boolean;
  error?: string;
  isSuccess: boolean;
  loginLink?: ReactNode;
}

export function ForgotPasswordForm({
  onSubmit,
  isLoading,
  error,
  isSuccess,
  loginLink,
}: ForgotPasswordFormProps) {
  const { control, handleSubmit } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
    },
  });

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {isSuccess ? (
        <div className="rounded-md bg-success/10 p-3 text-sm text-success-foreground" role="status">
          Check your email for a password reset link.
        </div>
      ) : (
        <>
          <FormInput
            control={control}
            name="email"
            label="Email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send reset link'}
          </Button>
        </>
      )}

      {loginLink && (
        <p className="text-center text-sm text-muted-foreground">
          Back to {loginLink}
        </p>
      )}
    </Form>
  );
}
