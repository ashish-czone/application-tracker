import { useCallback, useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, RotateCcw, KeyRound } from 'lucide-react';
import { format } from 'date-fns';
import {
  DataGrid, Badge, Button, useDataGridParams,
  Dialog, DialogContent, ConfirmDialog,
  type ColumnDef, type DataGridFilterField, type DataGridBulkAction,
} from '@packages/ui';
import { useUsers, useDeleteUser, useRestoreUser } from '../hooks';
import { AddUserForm } from '../components/AddUserForm';
import { EditUserForm } from '../components/EditUserForm';
import { ResetPasswordForm } from '../components/ResetPasswordForm';
import { usePlatformAPI } from '../../PlatformUIProvider';
import { createUsersApi } from '../services';
import type { User } from '../types';

const USER_TYPE_LABELS: Record<string, string> = {
  admin: 'Admin',
  client: 'Client',
};

export function UsersListPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<User | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const apiFn = usePlatformAPI();
  const usersApi = useMemo(() => createUsersApi(apiFn), [apiFn]);
  const {
    page, pageSize, search, sort, order,
    setPage, setPageSize, setSearch, setSort,
    filters, addFilter, removeFilter, clearAllFilters,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc', storageKey: 'users-list' });

  // Extract filter values for the API (which expects simple query params)
  const userType = useMemo(() => {
    const f = filters.find((expr) => expr.field === 'userType');
    if (!f) return undefined;
    return (f.operator === 'in' && Array.isArray(f.value)) ? f.value[0] as string : f.value as string;
  }, [filters]);

  const roleId = useMemo(() => {
    const f = filters.find((expr) => expr.field === 'roleId');
    if (!f) return undefined;
    return f.value as string;
  }, [filters]);

  const searchRoles = useCallback(
    async (query: string) => {
      const result = await usersApi.listRoles();
      const roles = result.data ?? [];
      const filtered = query
        ? roles.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
        : roles;
      return filtered.map((r) => ({ label: r.name, value: r.id }));
    },
    [usersApi],
  );

  const filterFields = useMemo<DataGridFilterField[]>(
    () => [
      {
        key: 'userType',
        label: 'Type',
        fieldType: 'picklist',
        options: [
          { label: 'Admin', value: 'admin' },
          { label: 'Client', value: 'client' },
        ],
      },
      {
        key: 'roleId',
        label: 'Role',
        fieldType: 'lookup',
        onSearchOptions: searchRoles,
      },
    ],
    [searchRoles],
  );

  const deleteMutation = useDeleteUser({
    onSuccess: () => setDeletingUser(null),
  });
  const restoreMutation = useRestoreUser();

  const { data, isLoading, isError, refetch } = useUsers({
    page,
    limit: pageSize,
    search: search || undefined,
    sort: sort || undefined,
    order,
    userType,
    roleId,
    includeDeleted: showDeleted,
  });

  const bulkActions = useMemo<DataGridBulkAction[]>(
    () => [
      {
        label: 'Delete',
        icon: Trash2,
        variant: 'destructive',
        onClick: (selectedIds) => {
          if (selectedIds.length === 1) {
            const user = data?.data.find((u) => u.id === selectedIds[0]);
            if (user) setDeletingUser(user);
          }
        },
      },
    ],
    [data?.data],
  );

  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        id: 'firstName',
        header: 'Name',
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {row.original.firstName} {row.original.lastName}
              </span>
              {row.original.deletedAt && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Deleted</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{row.original.email}</div>
          </div>
        ),
        enableSorting: true,
      },
      {
        id: 'email',
        header: 'Email',
        accessorKey: 'email',
        enableSorting: true,
        enableHiding: true,
      },
      {
        id: 'phone',
        header: 'Phone',
        accessorKey: 'phone',
        cell: ({ getValue }) => getValue() || '-',
        enableSorting: false,
        enableHiding: true,
      },
      {
        id: 'userType',
        header: 'Type',
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
        id: 'roles',
        header: 'Role',
        accessorFn: (row) => (row.roles ?? []).map((r) => r.name).join(', '),
        cell: ({ row }) => {
          const userRoles = row.original.roles ?? [];
          if (!userRoles.length) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {userRoles.map((r) => (
                <Badge key={r.id} variant="outline" className="text-xs">
                  {r.name}
                </Badge>
              ))}
            </div>
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
        cell: ({ row }) => {
          const isDeleted = !!row.original.deletedAt;
          if (isDeleted) {
            return (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => restoreMutation.mutate(row.original.id)}
                  disabled={restoreMutation.isPending}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-success hover:bg-success/10 transition-colors"
                  aria-label={`Restore ${row.original.firstName}`}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1 justify-end">
              <button
                type="button"
                onClick={() => setEditingUser(row.original)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label={`Edit ${row.original.firstName}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setResettingPasswordUser(row.original)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label={`Reset password for ${row.original.firstName}`}
                title="Reset password"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingUser(row.original)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label={`Delete ${row.original.firstName}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">Manage user accounts and permissions</p>
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
        searchPlaceholder="Search by name or email..."
        filterFields={filterFields}
        filters={filters}
        onFilterAdd={addFilter}
        onStructuredFilterRemove={removeFilter}
        onStructuredFiltersClear={clearAllFilters}
        enableSelection
        bulkActions={bulkActions}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        enableExport
        exportFilename="users"
        emptyState={{
          icon: Users,
          title: 'No users yet',
          description: 'Add your first user to get started.',
          action: { label: 'Add User', onClick: () => setAddModalOpen(true) },
        }}
        storageKey="users-list"
        rowClassName={(user) => user.deletedAt ? 'bg-muted/30 text-muted-foreground' : undefined}
        toolbarActions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="rounded border-input"
              />
              Include deleted
            </label>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add User
            </Button>
          </div>
        }
        renderCard={(user) => (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium text-foreground">
                {user.firstName} {user.lastName}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.userType === 'admin' ? 'default' : 'secondary'}>
                  {USER_TYPE_LABELS[user.userType] ?? user.userType}
                </Badge>
                <button
                  type="button"
                  onClick={() => setEditingUser(user)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setResettingPasswordUser(user)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Reset password"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingUser(user)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            {user.phone && (
              <div className="text-sm text-muted-foreground">{user.phone}</div>
            )}
            <div className="text-xs text-muted-foreground">
              Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}
            </div>
          </div>
        )}
      />

      {/* Add User Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <AddUserForm onClose={() => setAddModalOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-lg">
          {editingUser && (
            <EditUserForm user={editingUser} onClose={() => setEditingUser(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={!!resettingPasswordUser} onOpenChange={(open) => !open && setResettingPasswordUser(null)}>
        <DialogContent className="sm:max-w-md">
          {resettingPasswordUser && (
            <ResetPasswordForm user={resettingPasswordUser} onClose={() => setResettingPasswordUser(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        title="Delete user"
        description={
          deletingUser
            ? `This will permanently delete ${deletingUser.firstName} ${deletingUser.lastName} and all associated data.`
            : ''
        }
        confirmLabel="Delete user"
        isPending={deleteMutation.isPending}
        onConfirm={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
      />
    </div>
  );
}
