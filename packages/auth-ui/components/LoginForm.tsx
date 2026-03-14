import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, FormInput } from '@packages/ui';
import { loginSchema, type LoginFormValues } from '../schemas/loginSchema';
import type { ReactNode } from 'react';

interface LoginFormProps {
  onSubmit: (data: LoginFormValues) => void;
  isLoading: boolean;
  error?: string;
  registerLink?: ReactNode;
  forgotPasswordLink?: ReactNode;
}

export function LoginForm({
  onSubmit,
  isLoading,
  error,
  registerLink,
  forgotPasswordLink,
}: LoginFormProps) {
  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Enter your credentials to continue</p>
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
        autoComplete="current-password"
      />

      {forgotPasswordLink && (
        <div className="text-right text-sm">{forgotPasswordLink}</div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>

      {registerLink && (
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account? {registerLink}
        </p>
      )}
    </Form>
  );
}
