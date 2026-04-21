import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import {
  DataGridShell,
  Button,
  FilterPopover,
  CoarseTabs,
  SearchInput,
  ScreenLayout,
  type ActiveFilter,
} from '@packages/ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import type { UserRow, UserStatus } from './data/usersMock';
import { UserDetailDrawer } from './components/UserDetailDrawer';
import { USER_COLUMNS, REQUIRED_USER_COLUMN_KEYS } from './components/userColumns';
import {
  useUsersList,
  useResendInvitation,
  useDeactivateUser,
  useRestoreUser,
} from './api/useUsersApi';
import { mapUserRecordToRow } from './api/mapUserRecord';

type StatusTab = 'all' | UserStatus;

export function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);

  const { data, isLoading, isError } = useUsersList({
    limit: 500,
    includeDeleted: true,
  });
  const rows = useMemo<UserRow[]>(
    () => (data?.data ?? []).map(mapUserRecordToRow),
    [data],
  );

  const resendInvitation = useResendInvitation({
    onSuccess: () => setSelectedUser(null),
  });
  const deactivateUser = useDeactivateUser({
    onSuccess: () => setSelectedUser(null),
  });
  const restoreUser = useRestoreUser();

  const allRoleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of rows) {
      for (const r of u.roles) map.set(r.id, r.name);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  const statusCounts = useMemo(() => {
    const counts = { all: rows.length, active: 0, invited: 0, deactivated: 0 };
    for (const u of rows) counts[u.status] += 1;
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((u) => {
      if (statusTab !== 'all' && u.status !== statusTab) return false;
      if (roleFilter.length > 0 && !u.roles.some((r) => roleFilter.includes(r.id))) return false;
      if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusTab, roleFilter, search]);

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const chips: ActiveFilter[] = [];
    for (const key of roleFilter) {
      const role = allRoleOptions.find((r) => r.value === key);
      chips.push({
        key: `role:${key}`,
        group: 'Role',
        value: role?.label ?? key,
        onRemove: () => setRoleFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    return chips;
  }, [roleFilter, allRoleOptions]);

  const clearAll = useCallback(() => setRoleFilter([]), []);

  const totalUsers = rows.length;
  const activeUsers = statusCounts.active;
  const invitedUsers = statusCounts.invited;

  // "Active today" — users whose lastLoginAt is within today's UTC day. Kept
  // UTC-based to match the rest of the compliance screens' KPI derivation;
  // timezone-aware bucketing is a platform-wide concern, not a users screen one.
  const activeToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter((u) => u.lastActiveAt?.startsWith(today) ?? false).length;
  }, [rows]);

  const roleOptions = allRoleOptions.map((r) => ({
    ...r,
    count: rows.filter((u) => u.roles.some((role) => role.id === r.value)).length,
  }));

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalUsers },
    { value: 'active' as const, label: 'Active', count: statusCounts.active },
    { value: 'invited' as const, label: 'Invited', count: statusCounts.invited },
    {
      value: 'deactivated' as const,
      label: 'Deactivated',
      count: statusCounts.deactivated,
    },
  ];

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="users" />}
        breadcrumb={['Settings', 'Users']}
        title="Users"
        subtitle={
          isLoading ? (
            <>Loading users…</>
          ) : isError ? (
            <span className="text-signal">Failed to load users. Refresh to retry.</span>
          ) : (
            <>
              {totalUsers} team members — {activeUsers} active, {invitedUsers} pending invitations.
            </>
          )
        }
        actions={
          <Button size="sm">
            <UserPlus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
            Invite user
          </Button>
        }
        kpis={[
          {
            label: 'Total users',
            value: String(totalUsers),
            unit: 'members',
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [10, 11, 11, 12, 13, 14, totalUsers],
            sparklineTone: 'authority',
            footnote: `${activeUsers} active`,
          },
          {
            label: 'Active today',
            value: String(activeToday),
            unit: 'users',
            delta: `of ${activeUsers} active`,
            deltaTone: 'neutral',
            accent: 'filed',
            sparklineData: [5, 7, 8, 6, 9, 7, activeToday],
            sparklineTone: 'filed',
            footnote: 'logged in today',
          },
          {
            label: 'Pending invites',
            value: String(invitedUsers),
            unit: 'invitations',
            deltaTone: 'neutral',
            accent: 'due-soon',
            sparklineData: [0, 1, 0, 1, 2, 1, invitedUsers],
            sparklineTone: 'due-soon',
            footnote: 'awaiting acceptance',
          },
          {
            label: 'Roles in use',
            value: String(allRoleOptions.length),
            unit: 'roles',
            delta: `across ${totalUsers} users`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [3, 3, 4, 4, 5, 5, allRoleOptions.length],
            sparklineTone: 'authority',
            footnote: 'permission groups',
          },
        ]}
      >
        <section className="mt-10">
          <CoarseTabs tabs={statusTabs} value={statusTab} onChange={setStatusTab} animated />

          <DataGridShell
            columns={USER_COLUMNS}
            rows={filtered}
            getRowKey={(u) => u.id}
            requiredColumns={REQUIRED_USER_COLUMN_KEYS}
            totalRows={totalUsers}
            onRowClick={(user) => setSelectedUser(user)}
            activeFilters={activeFilters}
            onClearFilters={clearAll}
            emptyState={
              <div className="py-10 text-center text-sm text-ink-muted italic font-serif">
                {isError
                  ? 'Could not load users. Please refresh to retry.'
                  : isLoading
                  ? 'Loading users…'
                  : 'No users match the current filters.'}
              </div>
            }
            filters={
              <>
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users…"
                  wrapperClassName="min-w-[200px] max-w-xs flex-1"
                />
                <div className="flex items-center gap-2">
                  <FilterPopover
                    label="Role"
                    options={roleOptions}
                    value={roleFilter}
                    onChange={(v) => setRoleFilter(v as string[])}
                  />
                </div>
              </>
            }
          />
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {selectedUser && (
          <UserDetailDrawer
            key={selectedUser.id}
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onDeactivate={() => deactivateUser.mutate(selectedUser.id)}
            onRestore={() =>
              restoreUser.mutate(selectedUser.id, {
                onSuccess: () => setSelectedUser(null),
              })
            }
            onResendInvite={() => resendInvitation.mutate(selectedUser.id)}
            actionPending={
              deactivateUser.isPending ||
              restoreUser.isPending ||
              resendInvitation.isPending
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}
