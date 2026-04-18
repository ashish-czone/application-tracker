import { useState, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import { ScreenLayout } from '@packages/ui';
import {
  MOCK_ROLES,
  PERMISSION_REGISTRY,
  groupPermissionsByModule,
  type Role,
  type RoleMember,
} from './data/rolesMock';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { RoleListItem } from './components/RoleListItem';
import { RoleDetailPanel } from './components/RoleDetailPanel';

const PERMISSION_GROUPS = groupPermissionsByModule();

export function RolesEditorPage() {
  const [roles, setRoles] = useState<Role[]>(MOCK_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(MOCK_ROLES[0].id);

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

  const togglePermission = useCallback(
    (name: string) => {
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
    },
    [selectedRole.isSystem, selectedRoleId],
  );

  const toggleAllInModule = useCallback(
    (_module: string, names: string[], checked: boolean) => {
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
    },
    [selectedRole.isSystem, selectedRoleId],
  );

  const addMember = useCallback(
    (member: RoleMember) => {
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
    },
    [selectedRoleId],
  );

  const removeMember = useCallback(
    (memberId: string) => {
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
    },
    [selectedRoleId],
  );

  return (
    <ScreenLayout
      topBar={<ScreenPreviewTopBar active="roles" />}
      breadcrumb={['Settings', 'Roles & Permissions']}
      title="Roles & Permissions"
      subtitle={
        <>
          {roles.length} roles · {PERMISSION_REGISTRY.length} permissions across{' '}
          {PERMISSION_GROUPS.length} modules.
        </>
      }
    >
      <div
        ref={containerRef}
        className="flex border border-rule bg-paper-raised"
        style={{ height: 'calc(100vh - 260px)', minHeight: '540px' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          className="relative shrink-0 border-r border-rule flex flex-col"
          style={{ width: leftWidth }}
        >
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
                onSelect={() => setSelectedRoleId(role.id)}
              />
            ))}
          </div>

          <div
            onPointerDown={onPointerDown}
            className="group absolute top-0 bottom-0 -right-[7px] w-[14px] z-10 cursor-col-resize flex items-center justify-center"
          >
            <div className="grid grid-cols-2 gap-x-[4px] gap-y-[4px] opacity-40 group-hover:opacity-70 transition-opacity">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className="block w-1 h-1 rounded-full bg-ink-muted" />
              ))}
            </div>
          </div>
        </div>

        <RoleDetailPanel
          key={selectedRole.id}
          role={selectedRole}
          onTogglePermission={togglePermission}
          onToggleAllInModule={toggleAllInModule}
          onAddMember={addMember}
          onRemoveMember={removeMember}
        />
      </div>
    </ScreenLayout>
  );
}
