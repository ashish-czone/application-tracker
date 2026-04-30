import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import {
  useUsers as usePackageUsers,
  useUsersSummary as usePackageUsersSummary,
  useInviteUser as usePackageInviteUser,
  useResendInvitation as usePackageResendInvitation,
  useDeleteUser as usePackageDeleteUser,
  useRestoreUser as usePackageRestoreUser,
  createUsersApi,
  type ListUsersParams,
  type User,
  type UsersSummary,
} from '@packages/users-ui';

export type { User, ListUsersParams, UsersSummary };

/**
 * Thin domain-side adapter around `@packages/users-ui`. Lives here (not in
 * the package) so the compliance screen can pick exactly the hooks it needs
 * and future compliance-specific tweaks stay scoped to this feature. Other
 * apps that don't want the compliance-style screen import straight from
 * `@packages/users-ui`.
 */
export function useUsersList(params: ListUsersParams) {
  return usePackageUsers(params);
}

export function useUsersSummary() {
  return usePackageUsersSummary();
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

/**
 * Bulk soft-delete. Fires N parallel deletes (no bulk endpoint exists) and
 * surfaces a single summary toast. Partial failures are reported; TanStack
 * cache is invalidated once at the end.
 */
export function useBulkDeactivate(options?: { onSuccess?: () => void }) {
  const apiFn = usePlatformAPI();
  const queryClient = useQueryClient();
  const api = useMemo(() => createUsersApi(apiFn), [apiFn]);

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => api.deleteUser(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      return { total: ids.length, failed };
    },
    onSuccess: ({ total, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (failed === 0) {
        toast.success(`Deactivated ${total} user${total !== 1 ? 's' : ''}`);
      } else if (failed === total) {
        toast.error(`Failed to deactivate ${total} user${total !== 1 ? 's' : ''}`);
      } else {
        toast.message(
          `Deactivated ${total - failed} of ${total} — ${failed} failed`,
        );
      }
      options?.onSuccess?.();
    },
  });
}
