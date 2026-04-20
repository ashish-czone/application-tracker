import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { ScreenLayout } from '@packages/ui';
import { useRolesList, usePermissionRegistry, type Role } from '@packages/rbac-ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { RoleListItem } from './components/RoleListItem';
import { RoleDetailPanel } from './components/RoleDetailPanel';
import { AddRoleDrawer } from './components/AddRoleDrawer';
import { EditRoleDrawer } from './components/EditRoleDrawer';
import { groupPermissionsByModule } from './utils/permissions';

export function RolesEditorPage() {
  const { data: rolesData, isLoading: rolesLoading } = useRolesList({ limit: 100 });
  const { data: registry, isLoading: registryLoading } = usePermissionRegistry();

  const roles = rolesData?.data ?? [];
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const permissionGroups = useMemo(
    () => groupPermissionsByModule(registry ?? []),
    [registry],
  );

  const totalPermissions = registry?.length ?? 0;

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

  const selectedRole: Role | null =
    roles.find((r) => r.id === selectedRoleId) ?? roles[0] ?? null;

  return (
    <ScreenLayout
      topBar={<ScreenPreviewTopBar active="roles" />}
      breadcrumb={['Settings', 'Roles & Permissions']}
      title="Roles & Permissions"
      subtitle={
        rolesLoading || registryLoading ? (
          <>Loading…</>
        ) : (
          <>
            {roles.length} roles · {totalPermissions} permissions across{' '}
            {permissionGroups.length} modules.
          </>
        )
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
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1 text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rolesLoading ? (
              <div className="px-4 py-6 text-sm text-ink-muted font-sans">Loading roles…</div>
            ) : roles.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-muted font-sans">No roles defined.</div>
            ) : (
              roles.map((role) => (
                <RoleListItem
                  key={role.id}
                  role={role}
                  isSelected={role.id === selectedRole?.id}
                  onSelect={() => setSelectedRoleId(role.id)}
                />
              ))
            )}
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

        {selectedRole ? (
          <RoleDetailPanel
            key={selectedRole.id}
            role={selectedRole}
            permissionGroups={permissionGroups}
            totalPermissions={totalPermissions}
            onEdit={() => setEditOpen(true)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-ink-muted font-sans">
            {rolesLoading ? 'Loading…' : 'Select a role to view details.'}
          </div>
        )}
      </div>

      {addOpen && <AddRoleDrawer onClose={() => setAddOpen(false)} />}
      {editOpen && selectedRole && (
        <EditRoleDrawer role={selectedRole} onClose={() => setEditOpen(false)} />
      )}
    </ScreenLayout>
  );
}
