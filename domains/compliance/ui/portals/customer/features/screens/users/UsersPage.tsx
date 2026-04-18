import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  X,
  Mail,
  Phone,
  Shield,
  Building2,
  Clock,
  UserPlus,
  Ban,
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react';
import {
  MetricKPI,
  DataGridShell,
  Button,
  FilterPopover,
  CoarseTabs,
  Eyebrow,
  SearchInput,
  DetailRow,
  AvatarBadge,
  PageHeader,
  type DataTableColumn,
  type ActiveFilter,
} from '@packages/ui';
import { OrdinalDate } from '../../../../../components';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  MOCK_USERS,
  USER_STATUS_COUNTS,
  ALL_ROLE_OPTIONS,
  type UserRow,
  type UserStatus,
} from './usersMock';

// ─── Constants ──────────────────────────────────────────────────────

type StatusTab = 'all' | UserStatus;

const STATUS_DOT: Record<UserStatus, string> = {
  active: 'bg-filed',
  invited: 'bg-due-soon',
  deactivated: 'bg-ink-muted',
};

const STATUS_LABEL: Record<UserStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  deactivated: 'Deactivated',
};

// ─── Animation ──────────────────────────────────────────────────────

const EASE_OUT_EXPO = [0.32, 0.72, 0, 1] as const;

const drawerVariants = {
  hidden: { x: '100%' },
  visible: { x: 0 },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// ─── Sub-components ─────────────────────────────────────────────────

function StatusPill({ status }: { status: UserStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised">
      <span className={`w-1.5 h-1.5 flex-none ${STATUS_DOT[status]}`} aria-hidden />
      <span className="text-ink-soft">{STATUS_LABEL[status]}</span>
    </span>
  );
}

function RoleBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-[2px] border border-rule text-[10px] font-sans font-medium text-ink-soft bg-paper-raised whitespace-nowrap">
      {name}
    </span>
  );
}

// ─── User detail drawer ─────────────────────────────────────────────

function UserDetailDrawer({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <motion.div
        variants={drawerVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
        className="relative w-full max-w-xl h-full bg-paper-raised border-l border-rule flex flex-col"
      >
        {/* ─── Header ───────────────────────────────────────────── */}
        <header className="px-6 pt-6 pb-4 border-b border-rule flex-none">
          <div className="flex items-start justify-between gap-4 mb-4">
            <Eyebrow tone="muted" mark="§">User profile</Eyebrow>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <AvatarBadge initials={user.initials} size="xl" color={user.color} />
            <div className="min-w-0">
              <h2 className="font-serif text-2xl text-ink leading-tight">{user.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <StatusPill status={user.status} />
                {user.positions.length > 0 && (
                  <span className="font-serif italic text-[11px] text-ink-muted">
                    {user.positions[0].title}, {user.positions[0].unitName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ─── Body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Contact info */}
          <section className="px-6 py-5 border-b border-rule">
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Email">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                  <span className="font-mono text-[12px]">{user.email}</span>
                </span>
              </DetailRow>
              <DetailRow label="Phone">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                  <span className="font-mono text-[12px]">{user.phone}</span>
                </span>
              </DetailRow>
              <DetailRow label="Member since">
                <OrdinalDate date={user.createdAt} variant="short" className="text-sm" />
              </DetailRow>
              <DetailRow label="Last active">
                {user.lastActiveAt ? (
                  <OrdinalDate date={user.lastActiveAt} variant="short" className="text-sm" />
                ) : (
                  <span className="text-ink-muted italic">Never</span>
                )}
              </DetailRow>
            </div>
          </section>

          {/* Roles */}
          <section className="px-6 py-5 border-b border-rule">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
                  Roles
                </span>
              </div>
              <button
                type="button"
                className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-authority hover:text-authority-soft transition-colors"
              >
                + Assign role
              </button>
            </div>
            {user.roles.length > 0 ? (
              <div className="space-y-1.5">
                {user.roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between px-3 py-2 border border-rule bg-paper"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-authority" strokeWidth={1.5} />
                      <span className="text-sm font-sans text-ink">{role.name}</span>
                    </div>
                    <button
                      type="button"
                      className="text-ink-muted hover:text-signal transition-colors"
                      title="Remove role"
                    >
                      <X className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-serif italic text-ink-muted">No roles assigned</p>
            )}
          </section>

          {/* Positions */}
          <section className="px-6 py-5 border-b border-rule">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
                  Positions
                </span>
              </div>
              <button
                type="button"
                className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-authority hover:text-authority-soft transition-colors"
              >
                + Add position
              </button>
            </div>
            {user.positions.length > 0 ? (
              <div className="space-y-1.5">
                {user.positions.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between px-3 py-2 border border-rule bg-paper"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-sans text-ink">{pos.title}</div>
                      <div className="text-[11px] font-serif italic text-ink-muted">{pos.unitName}</div>
                    </div>
                    <button
                      type="button"
                      className="text-ink-muted hover:text-signal transition-colors flex-none"
                      title="Remove position"
                    >
                      <X className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-serif italic text-ink-muted">No positions assigned</p>
            )}
          </section>

          {/* Quick actions */}
          <section className="px-6 py-5">
            <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-3 block">
              Actions
            </span>
            <div className="flex flex-wrap gap-2">
              {user.status === 'active' && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule text-[11px] font-sans font-medium text-ink-soft hover:text-ink hover:border-ink transition-colors"
                >
                  <Ban className="w-3 h-3" strokeWidth={1.5} />
                  Deactivate
                </button>
              )}
              {user.status === 'deactivated' && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule text-[11px] font-sans font-medium text-ink-soft hover:text-ink hover:border-ink transition-colors"
                >
                  <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
                  Reactivate
                </button>
              )}
              {user.status === 'invited' && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule text-[11px] font-sans font-medium text-ink-soft hover:text-ink hover:border-ink transition-colors"
                >
                  <Mail className="w-3 h-3" strokeWidth={1.5} />
                  Resend invite
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule text-[11px] font-sans font-medium text-ink-soft hover:text-ink hover:border-ink transition-colors"
              >
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                View activity
              </button>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Table columns ──────────────────────────────────────────────────

const USER_COLUMNS: DataTableColumn<UserRow>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (u) => (
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="w-8 h-8 flex-none flex items-center justify-center text-[10px] font-sans font-semibold text-paper-raised"
          style={{ backgroundColor: u.color }}
        >
          {u.initials}
        </span>
        <div className="min-w-0">
          <span className="text-sm text-ink font-sans leading-snug truncate block">
            {u.name}
          </span>
          <span className="font-mono text-[11px] text-ink-muted truncate block">
            {u.email}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: 'roles',
    header: 'Roles',
    width: '220px',
    cell: (u) =>
      u.roles.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <RoleBadge key={r.id} name={r.name} />
          ))}
        </div>
      ) : (
        <span className="text-ink-muted text-[11px] italic">None</span>
      ),
  },
  {
    key: 'position',
    header: 'Position',
    width: '200px',
    cell: (u) =>
      u.positions.length > 0 ? (
        <div className="min-w-0">
          <span className="text-sm text-ink font-sans leading-snug truncate block">
            {u.positions[0].title}
          </span>
          <span className="font-serif italic text-[11px] text-ink-muted truncate block">
            {u.positions[0].unitName}
          </span>
        </div>
      ) : (
        <span className="text-ink-muted text-[11px] italic">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '120px',
    cell: (u) => <StatusPill status={u.status} />,
  },
  {
    key: 'lastActiveAt',
    header: 'Last active',
    width: '120px',
    cell: (u) =>
      u.lastActiveAt ? (
        <OrdinalDate date={u.lastActiveAt} variant="short" className="text-[11px]" />
      ) : (
        <span className="text-ink-muted text-[11px] italic">Never</span>
      ),
  },
];

const REQUIRED_COLUMN_KEYS = ['name'];

// ─── Page ───────────────────────────────────────────────────────────

export function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  // Filters
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

  // Active filter chips
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

  // KPIs
  const totalUsers = MOCK_USERS.length;
  const activeUsers = USER_STATUS_COUNTS.active;
  const activeToday = MOCK_USERS.filter((u) => {
    if (!u.lastActiveAt) return false;
    return u.lastActiveAt.startsWith('2026-04-17');
  }).length;
  const invitedUsers = USER_STATUS_COUNTS.invited;

  // Filter options with counts
  const roleOptions = ALL_ROLE_OPTIONS.map((r) => ({
    ...r,
    count: MOCK_USERS.filter((u) => u.roles.some((role) => role.id === r.value)).length,
  }));

  // Tabs
  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalUsers },
    { value: 'active' as const, label: 'Active', count: USER_STATUS_COUNTS.active },
    { value: 'invited' as const, label: 'Invited', count: USER_STATUS_COUNTS.invited },
    { value: 'deactivated' as const, label: 'Deactivated', count: USER_STATUS_COUNTS.deactivated },
  ];

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="users" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        <PageHeader
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
        />

        {/* ─── KPI row ──────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule">
          <MetricKPI
            label="Total users"
            value={String(totalUsers)}
            unit="members"
            delta="▲ 2 this month"
            deltaTone="positive"
            accent="authority"
            sparklineData={[10, 11, 11, 12, 13, 14, totalUsers]}
            sparklineTone="authority"
            footnote={`${activeUsers} active`}
            index={0}
          />
          <MetricKPI
            label="Active today"
            value={String(activeToday)}
            unit="users"
            delta={`of ${activeUsers} active`}
            deltaTone="neutral"
            accent="filed"
            sparklineData={[5, 7, 8, 6, 9, 7, activeToday]}
            sparklineTone="filed"
            footnote="logged in today"
            index={1}
          />
          <MetricKPI
            label="Pending invites"
            value={String(invitedUsers)}
            unit="invitations"
            delta="sent this week"
            deltaTone="neutral"
            accent="due-soon"
            sparklineData={[0, 1, 0, 1, 2, 1, invitedUsers]}
            sparklineTone="due-soon"
            footnote="awaiting acceptance"
            index={2}
          />
          <MetricKPI
            label="Roles in use"
            value={String(ALL_ROLE_OPTIONS.length)}
            unit="roles"
            delta={`across ${totalUsers} users`}
            deltaTone="neutral"
            accent="authority"
            sparklineData={[3, 3, 4, 4, 5, 5, ALL_ROLE_OPTIONS.length]}
            sparklineTone="authority"
            footnote="permission groups"
            index={3}
          />
        </section>

        {/* ─── Table section ────────────────────────────────────── */}
        <section className="mt-10">
          <CoarseTabs
            tabs={statusTabs}
            value={statusTab}
            onChange={setStatusTab}
            animated
          />

          <DataGridShell
            columns={USER_COLUMNS}
            rows={filtered}
            getRowKey={(u) => u.id}
            requiredColumns={REQUIRED_COLUMN_KEYS}
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
      </main>

      <AnimatePresence>
        {selectedUser && (
          <UserDetailDrawer
            key={selectedUser.id}
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
