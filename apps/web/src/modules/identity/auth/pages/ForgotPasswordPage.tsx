import { Link } from 'react-router';
import { ForgotPasswordForm } from '@packages/auth-ui';
import { useForgotPassword } from '../hooks/useForgotPassword';

export function ForgotPasswordPage() {
  const { mutate: forgotPassword, isPending, isSuccess, error } = useForgotPassword();

  return (
    <ForgotPasswordForm
      onSubmit={(data) => forgotPassword(data)}
      isLoading={isPending}
      isSuccess={isSuccess}
      error={error?.message}
      loginLink={<Link to="/login" className="text-primary hover:underline">Sign in</Link>}
    />
  );
}
