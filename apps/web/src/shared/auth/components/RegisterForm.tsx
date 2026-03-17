import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router';
import {
  Form,
  FormInput,
  FormEmailInput,
  FormPasswordInput,
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
    .max(128)
    .refine((p) => p.length >= 8, 'At least 8 characters')
    .refine((p) => /[A-Z]/.test(p), 'Uppercase letter required')
    .refine((p) => /[a-z]/.test(p), 'Lowercase letter required')
    .refine((p) => /[0-9]/.test(p), 'Number required'),
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
          <FormEmailInput
            control={control}
            name="email"
            label="Email"
            autoComplete="email"
          />
          <FormPasswordInput
            control={control}
            name="password"
            label="Password"
            autoComplete="new-password"
            showStrength
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
