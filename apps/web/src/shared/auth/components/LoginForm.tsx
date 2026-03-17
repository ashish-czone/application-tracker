import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router';
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
import { useLogin } from '../hooks/useLogin';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });
  const loginMutation = useLogin();

  function onSubmit(data: LoginFormValues) {
    loginMutation.mutate(data);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Log in</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <FormInput
            control={control}
            name="identifier"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
          <FormInput
            control={control}
            name="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          {loginMutation.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {(loginMutation.error as any)?.body?.message || 'Invalid credentials. Please try again.'}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Logging in...' : 'Log in'}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Link to="/register" className="text-primary hover:underline">
              Create account
            </Link>
            <Link to="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
