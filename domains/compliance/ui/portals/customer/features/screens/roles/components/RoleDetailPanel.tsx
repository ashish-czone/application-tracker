import { useMemo, useState } from 'react';
import { Shield, Trash2, UserPlus } from 'lucide-react';
import { SearchInput } from '@packages/ui';
import { groupPermissionsByModule, type Role, type RoleMember } from '../data/rolesMock';
import { PermissionGroup } from './PermissionGroup';
import { MemberRow } from './MemberRow';
import { AddMemberDropdown } from './AddMemberDropdown';

type DetailTab = 'permissions' | 'members';

const PERMISSION_GROUPS = groupPermissionsByModule();

export interface RoleDetailPanelProps {
  role: Role;
  onTogglePermission: (name: string) => void;
  onToggleAllInModule: (module: string, names: string[], checked: boolean) => void;
  onAddMember: (member: RoleMember) => void;
  onRemoveMember: (memberId: string) => void;
}

export function RoleDetailPanel({
  role,
  onTogglePermission,
  onToggleAllInModule,
  onAddMember,
  onRemoveMember,
}: RoleDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('permissions');
  const [permSearch, setPermSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const enabledPermissions = useMemo(() => new Set(role.permissions), [role.permissions]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return role.members;
    return role.members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [role.members, memberSearch]);

  const normalizedPermSearch = permSearch.trim().toLowerCase();

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
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-signal hover:bg-signal/5 border border-transparent hover:border-signal/30 transition-colors"
          >
            <Trash2 className="w-3 h-3" strokeWidth={1.5} />
            Delete
          </button>
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
              ? `Permissions (${role.permissions.length})`
              : `Members (${role.members.length})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'permissions' && (
          <div className="p-6">
            <div className="mb-4">
              <SearchInput
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                placeholder="Search permissions..."
                wrapperClassName="max-w-sm"
              />
              {role.isSystem && (
                <p className="mt-2 text-[11px] font-sans text-ink-muted italic">
                  System roles have all permissions and cannot be modified.
                </p>
              )}
            </div>

            <div className="space-y-3">
              {PERMISSION_GROUPS.map((group) => (
                <PermissionGroup
                  key={group.module}
                  module={group.module}
                  permissions={group.permissions}
                  enabledPermissions={enabledPermissions}
                  onToggle={onTogglePermission}
                  onToggleAll={onToggleAllInModule}
                  isSystemRole={role.isSystem}
                  search={normalizedPermSearch}
                />
              ))}
            </div>
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
                    roleId={role.id}
                    onAdd={onAddMember}
                    onClose={() => setAddMemberOpen(false)}
                  />
                )}
              </div>
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
                    onRemove={() => onRemoveMember(member.id)}
                    isSystemRole={role.isSystem}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
