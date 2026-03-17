import { useMemo, useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { format } from 'date-fns';
import {
  DataGrid, Badge, Button, useDataGridParams,
  Dialog, DialogContent,
  type ColumnDef, type DataGridFilter,
} from '@packages/ui';
import { useUsers } from '../hooks';
import { AddUserForm } from '../components/AddUserForm';
import type { User } from '../types';

const USER_TYPE_LABELS: Record<string, string> = {
  admin: 'Admin',
  client: 'Client',
};

const columns: ColumnDef<User, unknown>[] = [
  {
    id: 'firstName',
    header: 'Name',
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-foreground">
          {row.original.firstName} {row.original.lastName}
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
    id: 'createdAt',
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ getValue }) => format(new Date(getValue() as string), 'MMM d, yyyy'),
    enableSorting: true,
    enableHiding: true,
  },
];

export default function UsersListPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);
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

  const { data, isLoading, isError, refetch } = useUsers({
    page,
    limit: pageSize,
    search: search || undefined,
    sort: sort || undefined,
    order,
    userType,
  });

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
        activeFilters={activeFilters}
        onFilterRemove={(key) => setFilter(key, undefined)}
        onFiltersClear={() => clearFilters(['userType'])}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyState={{
          icon: Users,
          title: 'No users yet',
          description: 'Add your first user to get started.',
          action: { label: 'Add User', onClick: () => setAddModalOpen(true) },
        }}
        storageKey="users-list"
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
              <Badge variant={user.userType === 'admin' ? 'default' : 'secondary'}>
                {USER_TYPE_LABELS[user.userType] ?? user.userType}
              </Badge>
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

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <AddUserForm onClose={() => setAddModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
