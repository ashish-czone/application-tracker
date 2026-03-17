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
import { useRegister } from '../hooks/useRegister';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const { control, handleSubmit } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });
  const registerMutation = useRegister();

  function onSubmit(data: RegisterFormValues) {
    registerMutation.mutate(data);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>Enter your details to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              control={control}
              name="firstName"
              label="First name"
              placeholder="John"
              autoComplete="given-name"
            />
            <FormInput
              control={control}
              name="lastName"
              label="Last name"
              placeholder="Doe"
              autoComplete="family-name"
            />
          </div>
          <FormInput
            control={control}
            name="email"
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
            placeholder="At least 8 characters"
            autoComplete="new-password"
            description="Must contain uppercase, lowercase, and a number"
          />

          {registerMutation.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {(registerMutation.error as any)?.body?.message || 'Registration failed. Please try again.'}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Creating account...' : 'Create account'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </Form>
      </CardContent>
    </Card>
  );
}
