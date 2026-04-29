import { useMemo, useState } from 'react';
import { Shield, Plus, Pencil, Trash2, ShieldCheck, Lock } from 'lucide-react';
import { format } from 'date-fns';
import {
  DataGrid, Badge, Button, useDataGridParams,
  Dialog, DialogContent,
  type ColumnDef,
} from '@packages/ui';
import { useRolesList } from '../hooks';
import { AddRoleForm } from '../components/AddRoleForm';
import { EditRoleForm } from '../components/EditRoleForm';
import { PermissionsModal } from '../components/PermissionsModal';
import { DeleteRoleDialog } from '../components/DeleteRoleDialog';
import type { RbacEntity } from '../components/FieldPermissionsTab';
import type { Role } from '../types';

export interface RolesListPageProps {
  /** Entities the field-permissions tab can manage. Apps wire this from their entity registry. */
  entities: RbacEntity[];
}

export function RolesListPage({ entities }: RolesListPageProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [permissionsRole, setPermissionsRole] = useState<Role | null>(null);

  const {
    page, pageSize, search, sort, order,
    setPage, setPageSize, setSearch, setSort,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc', storageKey: 'roles-list' });

  const { data, isLoading, isError, refetch } = useRolesList({
    page,
    limit: pageSize,
    search: search || undefined,
    sort: sort as 'name' | 'createdAt' | undefined,
    order,
  });

  const columns = useMemo<ColumnDef<Role, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{row.original.name}</span>
            {row.original.isSystem && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-0.5">
                <Lock className="h-2.5 w-2.5" />
                System
              </Badge>
            )}
            {row.original.isDefault && !row.original.isSystem && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Default</Badge>
            )}
          </div>
        ),
        enableSorting: true,
      },
      {
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        cell: ({ getValue }) => format(new Date(getValue() as string), 'MMM d, yyyy'),
        enableSorting: true,
        enableHiding: true,
      },
      {
        id: 'actions',
        header: '',
        size: 110,
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const isSystem = row.original.isSystem;
          return (
            <div className="flex items-center gap-1 justify-end">
              <button
                type="button"
                onClick={() => setPermissionsRole(row.original)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label={`Permissions for ${row.original.name}`}
                title="Permissions"
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
              {!isSystem && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditingRole(row.original)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label={`Edit ${row.original.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingRole(row.original)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`Delete ${row.original.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Roles</h1>
          <p className="text-sm text-muted-foreground">Manage roles and their permissions</p>
        </div>
        <Button size="sm" onClick={() => setAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Role
        </Button>
      </div>

      <DataGrid
        columns={columns}
        data={data?.data ?? []}
        page={page}
        pageSize={pageSize}
        pageCount={data?.meta.totalPages ?? 0}
        totalRows={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sortColumn={sort}
        sortDirection={order}
        onSortChange={setSort}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search roles..."
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        enableExport
        exportFilename="roles"
        emptyState={{
          icon: Shield,
          title: 'No roles yet',
          description: 'Create your first role to manage user access.',
          action: { label: 'Add Role', onClick: () => setAddModalOpen(true) },
        }}
        storageKey="roles-list"
        renderCard={(role) => (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{role.name}</span>
                {role.isSystem && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-0.5">
                    <Lock className="h-2.5 w-2.5" />
                    System
                  </Badge>
                )}
                {role.isDefault && !role.isSystem && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Default</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPermissionsRole(role)}
                  className="p-1 text-muted-foreground hover:text-primary"
                  aria-label="Permissions"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                </button>
                {!role.isSystem && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingRole(role)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRole(role)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Created {format(new Date(role.createdAt), 'MMM d, yyyy')}
            </div>
          </div>
        )}
      />

      {/* Add Role Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <AddRoleForm onClose={() => setAddModalOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="sm:max-w-md">
          {editingRole && (
            <EditRoleForm role={editingRole} onClose={() => setEditingRole(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteRoleDialog
        role={deletingRole}
        onClose={() => setDeletingRole(null)}
      />

      {/* Permissions Modal */}
      <PermissionsModal
        role={permissionsRole}
        entities={entities}
        onClose={() => setPermissionsRole(null)}
      />
    </div>
  );
}
