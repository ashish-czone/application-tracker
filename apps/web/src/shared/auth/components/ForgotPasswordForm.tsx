import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router';
import { Mail } from 'lucide-react';
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
import { useForgotPassword } from '../hooks/useForgotPassword';

const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email is required').email('Invalid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const { control, handleSubmit } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: '' },
  });
  const mutation = useForgotPassword();

  function onSubmit(data: ForgotPasswordFormValues) {
    mutation.mutate(data, {
      onSuccess: () => setSubmitted(true),
    });
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
            <p className="text-sm text-muted-foreground">
              If an account with that email exists, we've sent a password reset link.
            </p>
            <Link to="/login" className="text-sm text-primary hover:underline mt-4">
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Forgot password</CardTitle>
        <CardDescription>
          Enter your email and we'll send you a link to reset your password
        </CardDescription>
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

          {mutation.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              Something went wrong. Please try again.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Sending...' : 'Send reset link'}
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
