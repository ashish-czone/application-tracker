import { Link, useSearchParams } from 'react-router';
import { ResetPasswordForm } from '@packages/auth-ui';
import { useResetPassword } from '../hooks/useResetPassword';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { mutate: resetPassword, isPending, isSuccess, error } = useResetPassword();

  return (
    <ResetPasswordForm
      onSubmit={(data) => resetPassword({ token, password: data.password })}
      isLoading={isPending}
      isSuccess={isSuccess}
      error={error?.message}
      loginLink={<Link to="/login" className="text-primary hover:underline">Sign in</Link>}
    />
  );
}
