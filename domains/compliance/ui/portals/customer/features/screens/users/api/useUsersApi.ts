import {
  useUsers as usePackageUsers,
  useRoles as usePackageRoles,
  useInviteUser as usePackageInviteUser,
  useResendInvitation as usePackageResendInvitation,
  useDeleteUser as usePackageDeleteUser,
  useRestoreUser as usePackageRestoreUser,
  type ListUsersParams,
  type User,
} from '@packages/users-ui';

export type { User, ListUsersParams };

/**
 * Thin domain-side adapter around `@packages/users-ui`. Lives here (not in
 * the package) so the compliance screen can pick exactly the hooks it needs
 * and future compliance-specific tweaks (e.g. pre-filtering to admin users
 * only) stay scoped to this feature. Other apps that don't want the
 * compliance-style screen import straight from `@packages/users-ui`.
 */
export function useUsersList(params: ListUsersParams = { limit: 500 }) {
  return usePackageUsers(params);
}

export function useAdminRoles() {
  return usePackageRoles('admin');
}

export function useInviteUser(options?: { onSuccess?: () => void }) {
  return usePackageInviteUser(options);
}

export function useResendInvitation(options?: { onSuccess?: () => void }) {
  return usePackageResendInvitation(options);
}

export function useDeactivateUser(options?: { onSuccess?: () => void }) {
  return usePackageDeleteUser(options);
}

export function useRestoreUser() {
  return usePackageRestoreUser();
}
