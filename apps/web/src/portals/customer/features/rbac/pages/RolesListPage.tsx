import { useMemo, useState } from 'react';
import { Shield, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import {
  DataGrid, Badge, Button, useDataGridParams,
  Dialog, DialogContent,
  type ColumnDef, type DataGridFilter,
} from '@packages/ui';
import { useRolesList } from '../hooks';
import { AddRoleForm } from '../components/AddRoleForm';
import { EditRoleForm } from '../components/EditRoleForm';
import { PermissionsModal } from '../components/PermissionsModal';
import { DeleteRoleDialog } from '../components/DeleteRoleDialog';
import type { Role } from '../types';

const USER_TYPE_LABELS: Record<string, string> = {
  admin: 'Admin',
  client: 'Client',
};

export default function RolesListPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [permissionsRole, setPermissionsRole] = useState<Role | null>(null);

  const {
    page,
    pageSize,
    search,
    sort,
    order,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    getFilter,
    setFilter,
    clearFilters,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc' });

  const userType = getFilter('userType');

  const { data, isLoading, isError, refetch } = useRolesList({
    page,
    limit: pageSize,
    search: search || undefined,
    sort: sort as 'name' | 'createdAt' | undefined,
    order,
    userType,
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
            {row.original.isSuperadmin && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">Superadmin</Badge>
            )}
            {row.original.isDefault && !row.original.isSuperadmin && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Default</Badge>
            )}
          </div>
        ),
        enableSorting: true,
      },
      {
        id: 'userType',
        header: 'User Type',
        accessorKey: 'userType',
        cell: ({ getValue }) => {
          const type = getValue() as string;
          return (
            <Badge variant={type === 'admin' ? 'default' : 'secondary'}>
              {USER_TYPE_LABELS[type] ?? type}
            </Badge>
          );
        },
        enableSorting: false,
        enableHiding: true,
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
        cell: ({ row }) => (
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
          </div>
        ),
      },
    ],
    [],
  );

  const activeFilters = useMemo<DataGridFilter[]>(() => {
    const filters: DataGridFilter[] = [];
    if (userType) {
      filters.push({
        key: 'userType',
        label: 'Type',
        value: USER_TYPE_LABELS[userType] ?? userType,
      });
    }
    return filters;
  }, [userType]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Roles</h1>
        <p className="text-sm text-muted-foreground">Manage roles and their permissions</p>
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
        activeFilters={activeFilters}
        onFilterRemove={(key) => setFilter(key, undefined)}
        onFiltersClear={() => clearFilters(['userType'])}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyState={{
          icon: Shield,
          title: 'No roles yet',
          description: 'Create your first role to manage user access.',
          action: { label: 'Add Role', onClick: () => setAddModalOpen(true) },
        }}
        storageKey="roles-list"
        toolbarActions={
          <div className="flex items-center gap-2">
            <select
              value={userType || ''}
              onChange={(e) => setFilter('userType', e.target.value || undefined)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All types</option>
              <option value="admin">Admin</option>
              <option value="client">Client</option>
            </select>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Role
            </Button>
          </div>
        }
        renderCard={(role) => (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{role.name}</span>
                {role.isSuperadmin && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0">Superadmin</Badge>
                )}
                {role.isDefault && !role.isSuperadmin && (
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
              </div>
            </div>
            <Badge variant={role.userType === 'admin' ? 'default' : 'secondary'}>
              {USER_TYPE_LABELS[role.userType] ?? role.userType}
            </Badge>
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
        onClose={() => setPermissionsRole(null)}
      />
    </div>
  );
}
