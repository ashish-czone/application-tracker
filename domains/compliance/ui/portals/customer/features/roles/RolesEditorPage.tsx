import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ScreenLayout, SearchInput } from '@packages/ui';
import { useRolesList, usePermissionManifests, type Role } from '@packages/rbac-ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { RoleListItem } from './components/RoleListItem';
import { RoleDetailPanel } from './components/RoleDetailPanel';
import { AddRoleDrawer } from './components/AddRoleDrawer';
import { EditRoleDrawer } from './components/EditRoleDrawer';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { groupPermissionsByModule } from './utils/permissions';

const SIDEBAR_PAGE_SIZE = 25;

export function RolesEditorPage() {
  // URL-synced page + search so sidebar state survives reload (and is
  // shareable). The detail-pane selection is local because it's tied to
  // the current visible page and mostly transient.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') ?? '';

  const setPage = useCallback(
    (p: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (p <= 1) next.delete('page');
          else next.set('page', String(p));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSearch = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set('search', value);
          else next.delete('search');
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: rolesData, isLoading: rolesLoading } = useRolesList({
    page,
    limit: SIDEBAR_PAGE_SIZE,
    search: debouncedSearch.trim() || undefined,
    sort: 'name',
    order: 'asc',
  });
  const { data: manifests, isLoading: manifestsLoading } = usePermissionManifests();

  const roles = rolesData?.data ?? [];
  const totalRoles = rolesData?.meta.total ?? 0;
  const totalPages = rolesData?.meta.totalPages ?? 0;
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    // Auto-select first row of the current page when nothing is selected,
    // OR when the previous selection isn't in the current page (e.g. user
    // changed page or refined the search and the prior pick is gone).
    if (roles.length === 0) return;
    if (!selectedRoleId || !roles.some((r) => r.id === selectedRoleId)) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const permissionGroups = useMemo(
    () => groupPermissionsByModule(manifests ?? []),
    [manifests],
  );

  const totalPermissions = manifests?.length ?? 0;

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
        rolesLoading || manifestsLoading ? (
          <>Loading…</>
        ) : (
          <>
            {totalRoles} roles · {totalPermissions} permissions across{' '}
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
          <div className="px-3 py-2 border-b border-rule">
            <SearchInput
              variant="bare"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles…"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {rolesLoading ? (
              <div className="px-4 py-6 text-sm text-ink-muted font-sans">Loading roles…</div>
            ) : roles.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-muted font-sans">
                {debouncedSearch ? 'No roles match your search.' : 'No roles defined.'}
              </div>
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
          {totalPages > 1 && (
            <div className="px-3 py-2 border-t border-rule flex items-center justify-between text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted">
              <span>
                {page} / {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="p-1 border border-rule hover:border-ink hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3 h-3" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="p-1 border border-rule hover:border-ink hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3 h-3" strokeWidth={2} />
                </button>
              </div>
            </div>
          )}

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
            onDeleted={() => setSelectedRoleId(null)}
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
