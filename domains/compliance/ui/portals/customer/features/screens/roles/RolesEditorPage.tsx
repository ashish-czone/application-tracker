import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Shield,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { AvatarBadge, Checkbox, SearchInput } from '@packages/ui';
import {
  MOCK_ROLES,
  PERMISSION_REGISTRY,
  groupPermissionsByModule,
  getAvailableMembers,
  type Role,
  type RoleMember,
} from './rolesMock';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

// ─── Constants ──────────────────────────────────────────────────────

type DetailTab = 'permissions' | 'members';

const PERMISSION_GROUPS = groupPermissionsByModule();

// ─── Role List Item ─────────────────────────────────────────────────

function RoleListItem({
  role,
  isSelected,
  onSelect,
}: {
  role: Role;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b border-rule transition-colors group ${
        isSelected
          ? 'bg-ink text-paper'
          : 'hover:bg-paper-sunken/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Shield
            className={`w-3.5 h-3.5 flex-none ${
              isSelected ? 'text-paper/70' : 'text-ink-muted'
            }`}
            strokeWidth={1.5}
          />
          <span
            className={`text-sm font-sans font-medium truncate ${
              isSelected ? 'text-paper' : 'text-ink'
            }`}
          >
            {role.name}
          </span>
          {role.isSystem && (
            <span
              className={`text-[9px] uppercase tracking-eyebrow font-sans font-semibold px-1.5 py-0.5 ${
                isSelected
                  ? 'bg-paper/15 text-paper/80'
                  : 'bg-authority/10 text-authority'
              }`}
            >
              System
            </span>
          )}
          {role.isDefault && (
            <span
              className={`text-[9px] uppercase tracking-eyebrow font-sans font-semibold px-1.5 py-0.5 ${
                isSelected
                  ? 'bg-paper/15 text-paper/80'
                  : 'bg-filed/10 text-filed'
              }`}
            >
              Default
            </span>
          )}
        </div>
        <span
          className={`font-mono text-[11px] tabular-nums flex-none ${
            isSelected ? 'text-paper/60' : 'text-ink-muted'
          }`}
        >
          {role.userCount}
        </span>
      </div>
      <div
        className={`mt-0.5 text-[10px] font-sans ${
          isSelected ? 'text-paper/50' : 'text-ink-muted'
        }`}
      >
        {role.permissions.length} of {PERMISSION_REGISTRY.length} permissions
      </div>
    </button>
  );
}

// ─── Permission Group ───────────────────────────────────────────────

function PermissionGroup({
  module,
  permissions,
  enabledPermissions,
  onToggle,
  onToggleAll,
  isSystemRole,
  search,
}: {
  module: string;
  permissions: { name: string; label: string }[];
  enabledPermissions: Set<string>;
  onToggle: (name: string) => void;
  onToggleAll: (module: string, names: string[], checked: boolean) => void;
  isSystemRole: boolean;
  search: string;
}) {
  const [expanded, setExpanded] = useState(true);

  const filtered = search
    ? permissions.filter(
        (p) =>
          p.label.toLowerCase().includes(search) ||
          p.name.toLowerCase().includes(search),
      )
    : permissions;

  if (filtered.length === 0) return null;

  const enabledCount = filtered.filter((p) => enabledPermissions.has(p.name)).length;
  const allChecked = enabledCount === filtered.length;
  const someChecked = enabledCount > 0 && !allChecked;
  const groupCheckState = allChecked
    ? true
    : someChecked
      ? ('indeterminate' as const)
      : false;

  return (
    <div className="border border-rule">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-paper-raised hover:bg-paper-sunken/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
        )}
        <Checkbox
          checked={groupCheckState}
          disabled={isSystemRole}
          onCheckedChange={(checked) => {
            onToggleAll(
              module,
              filtered.map((p) => p.name),
              !!checked,
            );
          }}
          onClick={(e) => e.stopPropagation()}
          className="border-rule data-[state=checked]:bg-ink data-[state=checked]:border-ink data-[state=indeterminate]:bg-ink data-[state=indeterminate]:border-ink"
        />
        <span className="flex-1 text-left text-sm font-sans font-medium text-ink">
          {module}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-ink-muted">
          {enabledCount} of {filtered.length}
        </span>
      </button>
      {expanded && (
        <div className="px-4 py-2 border-t border-rule bg-paper">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
            {filtered.map((p) => (
              <label
                key={p.name}
                className={`flex items-center gap-2.5 py-1.5 ${
                  isSystemRole ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group'
                }`}
              >
                <Checkbox
                  checked={enabledPermissions.has(p.name)}
                  disabled={isSystemRole}
                  onCheckedChange={() => onToggle(p.name)}
                  className="border-rule data-[state=checked]:bg-ink data-[state=checked]:border-ink"
                />
                <span className="text-[13px] font-sans text-ink group-hover:text-ink/80">
                  {p.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Members Table ──────────────────────────────────────────────────

function MemberRow({
  member,
  onRemove,
  isSystemRole,
}: {
  member: RoleMember;
  onRemove: () => void;
  isSystemRole: boolean;
}) {
  const addedDate = new Date(member.addedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-rule last:border-0 group">
      <AvatarBadge initials={member.initials} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-sans text-ink truncate">{member.name}</div>
        <div className="text-[11px] font-serif italic text-ink-muted truncate">
          {member.email}
        </div>
      </div>
      <span className="text-[10px] font-sans text-ink-muted uppercase tracking-eyebrow">
        {addedDate}
      </span>
      {!isSystemRole && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 text-ink-muted hover:text-signal transition-all"
          aria-label={`Remove ${member.name}`}
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

// ─── Add Member Popover ─────────────────────────────────────────────

function AddMemberDropdown({
  roleId,
  onAdd,
  onClose,
}: {
  roleId: string;
  onAdd: (member: RoleMember) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const available = getAvailableMembers(roleId);
  const filtered = query
    ? available.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.email.toLowerCase().includes(query.toLowerCase()),
      )
    : available;

  return (
    <div className="absolute right-0 top-full mt-1 z-20 w-72 border border-rule bg-paper-raised shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-rule">
        <SearchInput
          variant="bare"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users..."
          autoFocus
          wrapperClassName="flex-1"
        />
        <button
          type="button"
          onClick={onClose}
          className="text-ink-muted hover:text-ink"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-ink-muted font-sans">
            {available.length === 0 ? 'All users assigned' : 'No matches'}
          </div>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onAdd(m);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-paper-sunken/40 transition-colors text-left"
            >
              <AvatarBadge initials={m.initials} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-sans text-ink truncate">{m.name}</div>
                <div className="text-[10px] text-ink-muted font-sans truncate">{m.email}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

export function RolesEditorPage() {
  const [roles, setRoles] = useState<Role[]>(MOCK_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(MOCK_ROLES[0].id);
  const [activeTab, setActiveTab] = useState<DetailTab>('permissions');
  const [permSearch, setPermSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // ── Resizable split ─────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(280);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setLeftWidth(Math.max(200, Math.min(x, 480)));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];
  const enabledPermissions = useMemo(
    () => new Set(selectedRole.permissions),
    [selectedRole.permissions],
  );

  // ── Permission toggles ──────────────────────────────────────────

  function togglePermission(name: string) {
    if (selectedRole.isSystem) return;
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRoleId) return r;
        const perms = new Set(r.permissions);
        if (perms.has(name)) perms.delete(name);
        else perms.add(name);
        return { ...r, permissions: Array.from(perms) };
      }),
    );
  }

  function toggleAllInModule(_module: string, names: string[], checked: boolean) {
    if (selectedRole.isSystem) return;
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRoleId) return r;
        const perms = new Set(r.permissions);
        for (const n of names) {
          if (checked) perms.add(n);
          else perms.delete(n);
        }
        return { ...r, permissions: Array.from(perms) };
      }),
    );
  }

  // ── Member management ───────────────────────────────────────────

  function addMember(member: RoleMember) {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRoleId) return r;
        if (r.members.some((m) => m.id === member.id)) return r;
        return {
          ...r,
          members: [...r.members, { ...member, addedAt: new Date().toISOString() }],
          userCount: r.userCount + 1,
        };
      }),
    );
  }

  function removeMember(memberId: string) {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRoleId) return r;
        return {
          ...r,
          members: r.members.filter((m) => m.id !== memberId),
          userCount: Math.max(0, r.userCount - 1),
        };
      }),
    );
  }

  // ── Filtered members ────────────────────────────────────────────

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return selectedRole.members;
    return selectedRole.members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [selectedRole.members, memberSearch]);

  // ── Permission search ───────────────────────────────────────────

  const normalizedPermSearch = permSearch.trim().toLowerCase();

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="roles" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        {/* ─── Page header ──────────────────────────────────────────────── */}
        <header className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
              <span>Settings</span>
              <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              <span className="text-ink">Roles & Permissions</span>
            </div>
            <h1 className="font-serif text-4xl text-ink leading-none mt-1">
              Roles & Permissions
            </h1>
            <p className="mt-2 font-serif italic text-ink-soft max-w-2xl">
              {roles.length} roles · {PERMISSION_REGISTRY.length} permissions
              across {PERMISSION_GROUPS.length} modules.
            </p>
          </div>
        </header>

        {/* ─── Master-detail split ──────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex border border-rule bg-paper-raised"
          style={{ height: 'calc(100vh - 260px)', minHeight: '540px' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* ── Left: role list ──────────────────────────────────────── */}
          <div className="relative shrink-0 border-r border-rule flex flex-col" style={{ width: leftWidth }}>
            <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted">
                Roles
              </span>
              <button
                type="button"
                className="flex items-center gap-1 text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted hover:text-ink transition-colors"
              >
                <Plus className="w-3 h-3" strokeWidth={2} />
                New
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {roles.map((role) => (
                <RoleListItem
                  key={role.id}
                  role={role}
                  isSelected={role.id === selectedRoleId}
                  onSelect={() => {
                    setSelectedRoleId(role.id);
                    setPermSearch('');
                    setMemberSearch('');
                    setAddMemberOpen(false);
                  }}
                />
              ))}
            </div>

            {/* ── Resize handle — straddles the border ──────────── */}
            <div
              onPointerDown={onPointerDown}
              className="group absolute top-0 bottom-0 -right-[7px] w-[14px] z-10 cursor-col-resize flex items-center justify-center"
            >
              <div className="grid grid-cols-2 gap-x-[4px] gap-y-[4px] opacity-40 group-hover:opacity-70 transition-opacity">
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
                <span className="block w-1 h-1 rounded-full bg-ink-muted" />
              </div>
            </div>
          </div>

          {/* ── Right: detail panel ─────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Role header */}
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield
                  className="w-5 h-5 text-authority flex-none"
                  strokeWidth={1.5}
                />
                <div>
                  <h2 className="text-lg font-sans font-semibold text-ink leading-tight">
                    {selectedRole.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedRole.isSystem && (
                      <span className="text-[9px] uppercase tracking-eyebrow font-sans font-semibold px-1.5 py-0.5 bg-authority/10 text-authority">
                        System role
                      </span>
                    )}
                    {selectedRole.isDefault && (
                      <span className="text-[9px] uppercase tracking-eyebrow font-sans font-semibold px-1.5 py-0.5 bg-filed/10 text-filed">
                        Default
                      </span>
                    )}
                    <span className="text-[10px] font-sans text-ink-muted">
                      Created{' '}
                      {new Date(selectedRole.createdAt).toLocaleDateString(
                        'en-IN',
                        { day: 'numeric', month: 'short', year: 'numeric' },
                      )}
                    </span>
                  </div>
                </div>
              </div>
              {!selectedRole.isSystem && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-signal hover:bg-signal/5 border border-transparent hover:border-signal/30 transition-colors"
                >
                  <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                  Delete
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-rule flex">
              {(['permissions', 'members'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-[11px] uppercase tracking-eyebrow font-sans font-semibold transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'text-ink border-ink'
                      : 'text-ink-muted border-transparent hover:text-ink'
                  }`}
                >
                  {tab === 'permissions'
                    ? `Permissions (${selectedRole.permissions.length})`
                    : `Members (${selectedRole.members.length})`}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'permissions' && (
                <div className="p-6">
                  {/* Permission search */}
                  <div className="mb-4">
                    <SearchInput
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="Search permissions..."
                      wrapperClassName="max-w-sm"
                    />
                    {selectedRole.isSystem && (
                      <p className="mt-2 text-[11px] font-sans text-ink-muted italic">
                        System roles have all permissions and cannot be modified.
                      </p>
                    )}
                  </div>

                  {/* Permission groups */}
                  <div className="space-y-3">
                    {PERMISSION_GROUPS.map((group) => (
                      <PermissionGroup
                        key={group.module}
                        module={group.module}
                        permissions={group.permissions}
                        enabledPermissions={enabledPermissions}
                        onToggle={togglePermission}
                        onToggleAll={toggleAllInModule}
                        isSystemRole={selectedRole.isSystem}
                        search={normalizedPermSearch}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'members' && (
                <div className="p-6">
                  {/* Member toolbar */}
                  <div className="flex items-center gap-3 mb-4">
                    <SearchInput
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search members..."
                      wrapperClassName="flex-1 max-w-sm"
                    />
                    <div className="relative ml-auto">
                      <button
                        type="button"
                        onClick={() => setAddMemberOpen((prev) => !prev)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-paper text-[10px] uppercase tracking-eyebrow font-sans font-semibold hover:bg-ink/90 transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Add member
                      </button>
                      {addMemberOpen && (
                        <AddMemberDropdown
                          roleId={selectedRoleId}
                          onAdd={addMember}
                          onClose={() => setAddMemberOpen(false)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Members list */}
                  <div className="border border-rule">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-paper-sunken/30 border-b border-rule">
                      <span className="flex-none w-8" />
                      <span className="flex-1 text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted">
                        User
                      </span>
                      <span className="text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted">
                        Added
                      </span>
                      <span className="w-7" />
                    </div>
                    {filteredMembers.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <p className="text-sm text-ink-muted font-sans">
                          {memberSearch
                            ? 'No members match your search.'
                            : 'No members assigned to this role.'}
                        </p>
                      </div>
                    ) : (
                      filteredMembers.map((member) => (
                        <MemberRow
                          key={member.id}
                          member={member}
                          onRemove={() => removeMember(member.id)}
                          isSystemRole={selectedRole.isSystem}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
