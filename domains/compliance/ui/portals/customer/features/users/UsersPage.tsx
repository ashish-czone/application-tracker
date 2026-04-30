import { useEffect, useMemo, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { UserPlus, Ban } from 'lucide-react';
import {
  DataGridShell,
  BulkActionBar,
  Button,
  CoarseTabs,
  SearchInput,
  ScreenLayout,
  type ActiveFilter,
} from '@packages/ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import type { UserRow, UserStatus } from './types';
import { UserDetailDrawer } from './components/UserDetailDrawer';
import { InviteUserDrawer } from './components/InviteUserDrawer';
import { USER_COLUMNS, REQUIRED_USER_COLUMN_KEYS } from './components/userColumns';
import {
  useUsersList,
  useUsersSummary,
  useResendInvitation,
  useDeactivateUser,
  useRestoreUser,
  useBulkDeactivate,
  type ListUsersParams,
} from '../../../../hooks/useUsersApi';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { mapUserRecordToRow } from './api/mapUserRecord';

type StatusTab = 'all' | UserStatus;

const PAGE_LIMIT = 25;

function statusTabToParam(tab: StatusTab): UserStatus | undefined {
  return tab === 'all' ? undefined : tab;
}

export function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [page, setPage] = useState(1);

  // Reset page + selection when the filter shape changes — the user shouldn't
  // sit on page 5 of "active" after switching to "invited". Driven by the
  // debounced search so we don't reset (and refetch) on every keystroke.
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusTab, debouncedSearch]);

  const listParams = useMemo<ListUsersParams>(() => {
    const status = statusTabToParam(statusTab);
    return {
      page,
      limit: PAGE_LIMIT,
      search: debouncedSearch.trim() || undefined,
      status,
      // The deactivated tab needs `includeDeleted=true` so soft-deleted rows
      // come through. Other tabs filter to non-deleted rows by default.
      includeDeleted: status === 'deactivated' ? true : false,
    };
  }, [page, debouncedSearch, statusTab]);

  const { data, isLoading, isError } = useUsersList(listParams);
  const { data: summary } = useUsersSummary();

  const rows = useMemo<UserRow[]>(
    () => (data?.data ?? []).map(mapUserRecordToRow),
    [data],
  );
  const meta = data?.meta;
  const total = meta?.total ?? 0;

  const resendInvitation = useResendInvitation({
    onSuccess: () => setSelectedUser(null),
  });
  const deactivateUser = useDeactivateUser({
    onSuccess: () => setSelectedUser(null),
  });
  const restoreUser = useRestoreUser();
  const bulkDeactivate = useBulkDeactivate({
    onSuccess: () => setSelectedIds(new Set()),
  });

  // Prune selection to the currently-visible page.
  const visibleIds = useMemo(() => new Set(rows.map((u) => u.id)), [rows]);
  const effectiveSelectedIds = useMemo(() => {
    const next = new Set<string>();
    for (const id of selectedIds) if (visibleIds.has(id)) next.add(id);
    return next;
  }, [selectedIds, visibleIds]);

  const isRowSelectable = useCallback(
    (user: UserRow) => user.status !== 'deactivated',
    [],
  );

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: summary?.total ?? 0 },
    { value: 'active' as const, label: 'Active', count: summary?.active ?? 0 },
    { value: 'invited' as const, label: 'Invited', count: summary?.invited ?? 0 },
    {
      value: 'deactivated' as const,
      label: 'Deactivated',
      count: summary?.deactivated ?? 0,
    },
  ];

  const totalPages = meta?.totalPages ?? 0;
  const subtitle = isLoading ? (
    <>Loading users…</>
  ) : isError ? (
    <span className="text-signal">Failed to load users. Refresh to retry.</span>
  ) : summary ? (
    <>
      {summary.total} team members — {summary.active} active, {summary.invited} pending
      invitations.
    </>
  ) : (
    <>{total} team members</>
  );

  const activeFilters: ActiveFilter[] = [];

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="users" />}
        breadcrumb={['Settings', 'Users']}
        title="Users"
        subtitle={subtitle}
        actions={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
            Invite user
          </Button>
        }
      >
        <section className="mt-10">
          <CoarseTabs tabs={statusTabs} value={statusTab} onChange={setStatusTab} animated />

          <AnimatePresence>
            {effectiveSelectedIds.size > 0 && (
              <BulkActionBar
                count={effectiveSelectedIds.size}
                itemNoun="user"
                onClear={() => setSelectedIds(new Set())}
                actions={[
                  {
                    label: bulkDeactivate.isPending ? 'Deactivating…' : 'Deactivate',
                    icon: Ban,
                    tone: 'danger',
                    disabled: bulkDeactivate.isPending,
                    onClick: () =>
                      bulkDeactivate.mutate(Array.from(effectiveSelectedIds)),
                  },
                ]}
              />
            )}
          </AnimatePresence>

          <DataGridShell
            columns={USER_COLUMNS}
            rows={rows}
            getRowKey={(u) => u.id}
            requiredColumns={REQUIRED_USER_COLUMN_KEYS}
            totalRows={total}
            onRowClick={(user) => setSelectedUser(user)}
            activeFilters={activeFilters}
            selectable
            selectedKeys={effectiveSelectedIds}
            onSelectionChange={setSelectedIds}
            isRowSelectable={isRowSelectable}
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
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users…"
                wrapperClassName="min-w-[200px] max-w-xs flex-1"
              />
            }
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-3 border-t border-rule mt-2">
              <span className="text-[11px] font-sans tabular-nums text-ink-soft">
                {total > 0
                  ? `${(page - 1) * PAGE_LIMIT + 1}–${Math.min(page * PAGE_LIMIT, total)} of ${total}`
                  : '0 of 0'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1 text-[11px] uppercase tracking-eyebrow font-sans font-medium border border-rule text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-[11px] uppercase tracking-eyebrow font-sans font-medium border border-rule text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {inviteOpen && <InviteUserDrawer onClose={() => setInviteOpen(false)} />}
      </AnimatePresence>

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
