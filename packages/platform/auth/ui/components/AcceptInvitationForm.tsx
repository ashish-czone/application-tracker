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
import { useAcceptInvitation } from '../hooks/useAcceptInvitation';

const acceptInvitationSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
});

type AcceptInvitationFormValues = z.infer<typeof acceptInvitationSchema>;

export function AcceptInvitationForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const form = useForm<AcceptInvitationFormValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { newPassword: '' },
  });
  const mutation = useAcceptInvitation();

  if (!token) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Invalid invitation link</h3>
            <p className="text-sm text-muted-foreground">
              This invitation link is missing a token. Please use the link from your invitation email.
            </p>
            <Link to="/login" className="text-sm text-primary hover:underline mt-2">
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  function onSubmit(data: AcceptInvitationFormValues) {
    mutation.mutate({ token: token!, newPassword: data.newPassword });
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Accept your invitation</CardTitle>
        <CardDescription>Set a password to activate your account</CardDescription>
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
              {(mutation.error as any)?.body?.message ||
                'Failed to accept invitation. The link may have expired.'}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Activating…' : 'Activate account'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Already have an account? Log in
            </Link>
          </p>
        </Form>
      </CardContent>
    </Card>
  );
}
