import { useEffect, useMemo, useState } from 'react';
import { Pencil, Shield, Trash2, UserPlus } from 'lucide-react';
import { ConfirmDialog, SearchInput } from '@packages/ui';
import {
  useDeleteRole,
  useRolePermissions,
  useSetRolePermissions,
  useRoleMembers,
  useAddRoleMember,
  useRemoveRoleMember,
  type Role,
  type BooleanPermissions,
} from '@packages/rbac-ui';
import { PermissionGroup } from './PermissionGroup';
import { MemberRow } from './MemberRow';
import { AddMemberDropdown } from './AddMemberDropdown';
import type { PermissionModuleGroup } from '../utils/permissions';
import { formatMemberName } from '../utils/permissions';

type DetailTab = 'permissions' | 'members';

export interface RoleDetailPanelProps {
  role: Role;
  permissionGroups: PermissionModuleGroup[];
  totalPermissions: number;
  onEdit?: () => void;
  onDeleted?: () => void;
}

export function RoleDetailPanel({
  role,
  permissionGroups,
  totalPermissions,
  onEdit,
  onDeleted,
}: RoleDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('permissions');
  const [permSearch, setPermSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useDeleteRole({
    onSuccess: () => {
      setDeleteOpen(false);
      onDeleted?.();
    },
  });

  const { data: rolePermissions, isLoading: permsLoading } = useRolePermissions(role.id);
  const { data: membersData, isLoading: membersLoading } = useRoleMembers(role.id, { limit: 100 });

  const [selected, setSelected] = useState<BooleanPermissions>({});
  useEffect(() => {
    if (rolePermissions) setSelected({ ...rolePermissions });
  }, [rolePermissions]);

  const setPermsMutation = useSetRolePermissions();
  const addMemberMutation = useAddRoleMember();
  const removeMemberMutation = useRemoveRoleMember();

  const enabledPermissions = useMemo(() => new Set(Object.keys(selected)), [selected]);

  const members = membersData?.data ?? [];
  const excludedUserIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = formatMemberName(m).toLowerCase();
      return name.includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [members, memberSearch]);

  const normalizedPermSearch = permSearch.trim().toLowerCase();

  const togglePermission = (name: string) => {
    if (role.isSystem) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[name]) delete next[name];
      else next[name] = true;
      return next;
    });
  };

  const toggleAllInModule = (_module: string, names: string[], checked: boolean) => {
    if (role.isSystem) return;
    setSelected((prev) => {
      const next = { ...prev };
      for (const n of names) {
        if (checked) next[n] = true;
        else delete next[n];
      }
      return next;
    });
  };

  const isDirty = useMemo(() => {
    const current = rolePermissions ?? {};
    const currentKeys = Object.keys(current).sort();
    const selectedKeys = Object.keys(selected).sort();
    if (currentKeys.length !== selectedKeys.length) return true;
    return currentKeys.some((k, i) => k !== selectedKeys[i]);
  }, [rolePermissions, selected]);

  const savePermissions = () => {
    if (role.isSystem) return;
    setPermsMutation.mutate({
      roleId: role.id,
      permissions: Object.keys(selected).map((name) => ({ name })),
    });
  };

  const resetPermissions = () => {
    setSelected(rolePermissions ? { ...rolePermissions } : {});
  };

  const handleAddMember = (userId: string) => {
    addMemberMutation.mutate({ roleId: role.id, userId });
  };

  const handleRemoveMember = (userId: string) => {
    removeMemberMutation.mutate({ roleId: role.id, userId });
  };

  const enabledCount = enabledPermissions.size;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-authority flex-none" strokeWidth={1.5} />
          <div>
            <h2 className="text-lg font-sans font-semibold text-ink leading-tight">{role.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {role.isSystem && (
                <span className="text-[9px] uppercase tracking-eyebrow font-sans font-semibold px-1.5 py-0.5 bg-authority/10 text-authority">
                  System role
                </span>
              )}
              {role.isDefault && (
                <span className="text-[9px] uppercase tracking-eyebrow font-sans font-semibold px-1.5 py-0.5 bg-filed/10 text-filed">
                  Default
                </span>
              )}
              <span className="text-[10px] font-sans text-ink-muted">
                Created{' '}
                {new Date(role.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
        {!role.isSystem && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted hover:text-ink border border-transparent hover:border-rule transition-colors"
            >
              <Pencil className="w-3 h-3" strokeWidth={1.5} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-signal hover:bg-signal/5 border border-transparent hover:border-signal/30 transition-colors"
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              Delete
            </button>
          </div>
        )}
      </div>

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
              ? `Permissions (${enabledCount}/${totalPermissions})`
              : `Members (${members.length})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'permissions' && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <SearchInput
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                placeholder="Search permissions..."
                wrapperClassName="max-w-sm flex-1"
              />
              {!role.isSystem && isDirty && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetPermissions}
                    disabled={setPermsMutation.isPending}
                    className="px-3 py-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={savePermissions}
                    disabled={setPermsMutation.isPending}
                    className="px-3 py-1.5 bg-ink text-paper text-[10px] uppercase tracking-eyebrow font-sans font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
                  >
                    {setPermsMutation.isPending ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>

            {role.isSystem && (
              <p className="mb-2 text-[11px] font-sans text-ink-muted italic">
                System roles have all permissions and cannot be modified.
              </p>
            )}

            {permsLoading ? (
              <div className="py-6 text-sm text-ink-muted font-sans">Loading permissions…</div>
            ) : permissionGroups.length === 0 ? (
              <div className="py-6 text-sm text-ink-muted font-sans">
                No permissions registered yet.
              </div>
            ) : (
              <div className="space-y-3">
                {permissionGroups.map((group) => (
                  <PermissionGroup
                    key={group.module}
                    module={group.module}
                    permissions={group.permissions}
                    enabledPermissions={enabledPermissions}
                    onToggle={togglePermission}
                    onToggleAll={toggleAllInModule}
                    isSystemRole={role.isSystem}
                    search={normalizedPermSearch}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <SearchInput
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members..."
                wrapperClassName="flex-1 max-w-sm"
              />
              {!role.isSystem && (
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
                      excludedUserIds={excludedUserIds}
                      onAdd={handleAddMember}
                      onClose={() => setAddMemberOpen(false)}
                      disabled={addMemberMutation.isPending}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="border border-rule">
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
              {membersLoading ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-ink-muted font-sans">Loading members…</p>
                </div>
              ) : filteredMembers.length === 0 ? (
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
                    onRemove={() => handleRemoveMember(member.id)}
                    isSystemRole={role.isSystem}
                    isRemoving={removeMemberMutation.isPending}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => !deleteMutation.isPending && setDeleteOpen(open)}
        title="Delete role?"
        description={`"${role.name}" will be removed. Any user assignments go away and the role's permissions are archived.`}
        confirmLabel="Delete role"
        destructive
        isPending={deleteMutation.isPending}
        pendingLabel="Deleting…"
        onConfirm={() => deleteMutation.mutate(role.id)}
      />
    </div>
  );
}
