import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormInput } from '@packages/ui';
import { registerSchema, type RegisterFormValues } from '../schemas/registerSchema';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import type { ReactNode } from 'react';

interface RegisterFormProps {
  onSubmit: (data: Omit<RegisterFormValues, 'confirmPassword'>) => void;
  isLoading: boolean;
  error?: string;
  loginLink?: ReactNode;
}

export function RegisterForm({ onSubmit, isLoading, error, loginLink }: RegisterFormProps) {
  const { control, handleSubmit, watch, setValue } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
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

  function handleFormSubmit(data: RegisterFormValues) {
    const { confirmPassword: _, ...rest } = data;
    onSubmit(rest);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground">Enter your details to get started</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <FormInput
        control={control}
        name="email"
        label="Email"
        type="email"
        placeholder="name@example.com"
        autoComplete="email"
      />

      <FormInput
        control={control}
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
      />

      {password && <PasswordStrengthMeter password={password} />}

      <FormInput
        control={control}
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
      />

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Create account'}
      </Button>

      {loginLink && (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? {loginLink}
        </p>
      )}
    </form>
  );
}
