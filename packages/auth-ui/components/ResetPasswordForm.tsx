import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, FormInput } from '@packages/ui';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas/resetPasswordSchema';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import type { ReactNode } from 'react';

interface ResetPasswordFormProps {
  onSubmit: (data: { password: string }) => void;
  isLoading: boolean;
  error?: string;
  isSuccess: boolean;
  loginLink?: ReactNode;
}

export function ResetPasswordForm({
  onSubmit,
  isLoading,
  error,
  isSuccess,
  loginLink,
}: ResetPasswordFormProps) {
  const { control, handleSubmit, watch, setValue } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  useEffect(() => {
    return () => {
      setValue('password', '');
      setValue('confirmPassword', '');
    };
  }, [setValue]);

  function handleFormSubmit(data: ResetPasswordFormValues) {
    onSubmit({ password: data.password });
  }

  return (
    <Form onSubmit={handleSubmit(handleFormSubmit)}>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">Enter your new password</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {isSuccess ? (
        <div className="rounded-md bg-success/10 p-3 text-sm text-success-foreground" role="status">
          Your password has been reset successfully.
        </div>
      ) : (
        <>
          <FormInput
            control={control}
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
          />

          {password && <PasswordStrengthMeter password={password} />}

          <FormInput
            control={control}
            name="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Resetting...' : 'Reset password'}
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
