import { useMemo, useState } from 'react';
import { FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  DataGrid, Badge, Button, useDataGridParams,
  Dialog, DialogContent, ConfirmDialog,
  type ColumnDef, type DataGridFilter,
} from '@packages/ui';
import { useTemplates, useDeleteTemplate } from '../hooks';
import { TemplateFormModal } from '../components/TemplateFormModal';
import type { NotificationTemplate, NotificationChannel } from '../types';

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  in_app: 'In-App',
  whatsapp: 'WhatsApp',
};

export function TemplatesListPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [deleting, setDeleting] = useState<NotificationTemplate | null>(null);

  const {
    page, pageSize, search, sort, order,
    setPage, setPageSize, setSearch, setSort,
    getFilter, setFilter, clearFilters,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc' });

  const channel = getFilter('channel') as NotificationChannel | undefined;

  const { data, isLoading, isError, refetch } = useTemplates({
    page, limit: pageSize, search: search || undefined,
    sort: sort as 'name' | 'createdAt' | undefined, order, channel,
  });

  const deleteMutation = useDeleteTemplate({ onSuccess: () => setDeleting(null) });

  const columns = useMemo<ColumnDef<NotificationTemplate, unknown>[]>(() => [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue() as string}</span>,
      enableSorting: true,
    },
    {
      id: 'channel',
      header: 'Channel',
      accessorKey: 'channel',
      cell: ({ getValue }) => {
        const ch = getValue() as NotificationChannel;
        return <Badge variant="secondary">{CHANNEL_LABELS[ch] ?? ch}</Badge>;
      },
      enableSorting: false,
    },
    {
      id: 'subject',
      header: 'Subject',
      accessorKey: 'subject',
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        return val ? <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{val}</span> : <span className="text-muted-foreground">—</span>;
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
      size: 80,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <button type="button" onClick={() => setEditing(row.original)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setDeleting(row.original)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ], []);

  const activeFilters = useMemo<DataGridFilter[]>(() => {
    const filters: DataGridFilter[] = [];
    if (channel) filters.push({ key: 'channel', label: 'Channel', value: CHANNEL_LABELS[channel] ?? channel });
    return filters;
  }, [channel]);

  return (
    <div>
      <DataGrid
        columns={columns}
        data={data?.data ?? []}
        page={page} pageSize={pageSize}
        pageCount={data?.meta.totalPages ?? 0}
        totalRows={data?.meta.total ?? 0}
        onPageChange={setPage} onPageSizeChange={setPageSize}
        sortColumn={sort} sortDirection={order} onSortChange={setSort}
        search={search} onSearchChange={setSearch}
        searchPlaceholder="Search templates..."
        activeFilters={activeFilters}
        onFilterRemove={(key) => setFilter(key, undefined)}
        onFiltersClear={() => clearFilters(['channel'])}
        isLoading={isLoading} isError={isError} onRetry={refetch}
        emptyState={{
          icon: FileText,
          title: 'No templates yet',
          description: 'Create your first notification template.',
          action: { label: 'Create Template', onClick: () => setAddOpen(true) },
        }}
        storageKey="templates-list"
        toolbarActions={
          <div className="flex items-center gap-2">
            <select
              value={channel || ''}
              onChange={(e) => setFilter('channel', e.target.value || undefined)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All channels</option>
              <option value="email">Email</option>
              <option value="in_app">In-App</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Template
            </Button>
          </div>
        }
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <TemplateFormModal onClose={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          {editing && <TemplateFormModal template={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete template"
        description={deleting ? `Delete "${deleting.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
