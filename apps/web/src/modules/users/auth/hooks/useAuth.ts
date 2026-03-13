import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api/authApi';

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    staleTime: Infinity,
    retry: false,
  });

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
    permissions: user?.permissions ?? [],
  };
}
