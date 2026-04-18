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
import {
  MOCK_USERS,
  USER_STATUS_COUNTS,
  ALL_ROLE_OPTIONS,
  type UserRow,
  type UserStatus,
} from './data/usersMock';
import { UserDetailDrawer } from './components/UserDetailDrawer';
import { USER_COLUMNS, REQUIRED_USER_COLUMN_KEYS } from './components/userColumns';

type StatusTab = 'all' | UserStatus;

export function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_USERS.filter((u) => {
      if (statusTab !== 'all' && u.status !== statusTab) return false;
      if (roleFilter.length > 0 && !u.roles.some((r) => roleFilter.includes(r.id))) return false;
      if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [statusTab, roleFilter, search]);

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const chips: ActiveFilter[] = [];
    for (const key of roleFilter) {
      const role = ALL_ROLE_OPTIONS.find((r) => r.value === key);
      chips.push({
        key: `role:${key}`,
        group: 'Role',
        value: role?.label ?? key,
        onRemove: () => setRoleFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    return chips;
  }, [roleFilter]);

  const clearAll = useCallback(() => setRoleFilter([]), []);

  const totalUsers = MOCK_USERS.length;
  const activeUsers = USER_STATUS_COUNTS.active;
  const activeToday = MOCK_USERS.filter(
    (u) => u.lastActiveAt?.startsWith('2026-04-17') ?? false,
  ).length;
  const invitedUsers = USER_STATUS_COUNTS.invited;

  const roleOptions = ALL_ROLE_OPTIONS.map((r) => ({
    ...r,
    count: MOCK_USERS.filter((u) => u.roles.some((role) => role.id === r.value)).length,
  }));

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalUsers },
    { value: 'active' as const, label: 'Active', count: USER_STATUS_COUNTS.active },
    { value: 'invited' as const, label: 'Invited', count: USER_STATUS_COUNTS.invited },
    {
      value: 'deactivated' as const,
      label: 'Deactivated',
      count: USER_STATUS_COUNTS.deactivated,
    },
  ];

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="users" />}
        breadcrumb={['Settings', 'Users']}
        title="Users"
        subtitle={
          <>
            {totalUsers} team members — {activeUsers} active, {invitedUsers} pending invitations.
          </>
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
            delta: '▲ 2 this month',
            deltaTone: 'positive',
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
            delta: 'sent this week',
            deltaTone: 'neutral',
            accent: 'due-soon',
            sparklineData: [0, 1, 0, 1, 2, 1, invitedUsers],
            sparklineTone: 'due-soon',
            footnote: 'awaiting acceptance',
          },
          {
            label: 'Roles in use',
            value: String(ALL_ROLE_OPTIONS.length),
            unit: 'roles',
            delta: `across ${totalUsers} users`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [3, 3, 4, 4, 5, 5, ALL_ROLE_OPTIONS.length],
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
          />
        )}
      </AnimatePresence>
    </>
  );
}
