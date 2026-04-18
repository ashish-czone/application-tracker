import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Forbidden } from './Forbidden';

interface PermissionGuardProps {
  permission: string;
  children: ReactNode;
  /**
   * Custom fallback rendered when the user lacks the permission. Defaults to
   * the standard `<Forbidden />` page. Pass `null` to render nothing.
   */
  fallback?: ReactNode;
}

/**
 * Route-level permission gate. Use inside an authenticated tree (i.e. below
 * `AuthGuard`) — this component does NOT verify authentication, only that the
 * current user holds the named permission. For component-level visibility
 * checks inside a page, prefer `<Can>` which renders nothing by default.
 */
export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const { can, isLoading } = useAuth();

  if (isLoading) return null;

  if (!can(permission)) {
    return <>{fallback ?? <Forbidden permission={permission} />}</>;
  }

  return <>{children}</>;
}
