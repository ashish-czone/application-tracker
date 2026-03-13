import { Link } from 'react-router';
import { RegisterForm } from '@packages/auth-ui';
import { useRegister } from '../hooks/useRegister';

export function RegisterPage() {
  const { mutate: register, isPending, error } = useRegister();

  return (
    <RegisterForm
      onSubmit={(data) => register(data)}
      isLoading={isPending}
      error={error?.message}
      loginLink={<Link to="/login" className="text-primary hover:underline">Sign in</Link>}
    />
  );
}
