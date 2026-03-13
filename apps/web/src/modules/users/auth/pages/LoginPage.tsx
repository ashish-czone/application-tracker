import { Link } from 'react-router';
import { LoginForm } from '@packages/auth-ui';
import { useLogin } from '../hooks/useLogin';

export function LoginPage() {
  const { mutate: login, isPending, error } = useLogin();

  return (
    <LoginForm
      onSubmit={(data) => login(data)}
      isLoading={isPending}
      error={error?.message}
      registerLink={<Link to="/register" className="text-primary hover:underline">Sign up</Link>}
      forgotPasswordLink={
        <Link to="/forgot-password" className="text-primary hover:underline">
          Forgot password?
        </Link>
      }
    />
  );
}
