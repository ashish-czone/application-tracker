import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Users, Plus, Trash2, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import {
  DataGrid, DataGridFilters, Badge, Button, useDataGridParams, useActiveFilters,
  Dialog, DialogContent, ConfirmDialog,
  type ColumnDef, type DataGridFilterConfig,
} from '@packages/ui';
import { useCandidates, useDeleteCandidate, useRestoreCandidate } from '../hooks';
import { AddCandidateForm } from '../components/AddCandidateForm';
import type { Candidate } from '../types';
import { SOURCE_OPTIONS } from '../types';

const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_OPTIONS.map((o) => [o.value, o.label]),
);

const CANDIDATE_FILTERS: DataGridFilterConfig[] = [
  {
    key: 'source',
    label: 'Source',
    placeholder: 'All sources',
    options: [...SOURCE_OPTIONS],
  },
];

export default function CandidatesListPage() {
  const navigate = useNavigate();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deletingCandidate, setDeletingCandidate] = useState<Candidate | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const {
    page, pageSize, search, sort, order,
    setPage, setPageSize, setSearch, setSort,
    getFilter, setFilter, clearFilters,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc' });

  const source = getFilter('source');
  const activeFilters = useActiveFilters(CANDIDATE_FILTERS, getFilter);

  const deleteMutation = useDeleteCandidate({ onSuccess: () => setDeletingCandidate(null) });
  const restoreMutation = useRestoreCandidate();

  const { data, isLoading, isError, refetch } = useCandidates({
    page,
    limit: pageSize,
    search: search || undefined,
    sort: sort || undefined,
    order,
    source,
    includeDeleted: showDeleted,
  });

  const columns = useMemo<ColumnDef<Candidate, unknown>[]>(
    () => [
      {
        id: 'firstName',
        header: 'Name',
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        cell: ({ row }) => {
          const c = row.original;
          const isDeleted = !!c.deletedAt;
          return (
            <div className={isDeleted ? 'opacity-50' : ''}>
              <div className="flex items-center gap-2">
                {isDeleted ? (
                  <span className="font-medium text-foreground">
                    {c.firstName} {c.lastName}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/candidates/${c.id}`)}
                    className="font-medium text-primary hover:underline text-left"
                  >
                    {c.firstName} {c.lastName}
                  </button>
                )}
                {isDeleted && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Deleted</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{c.email}</div>
            </div>
          );
        },
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
        id: 'source',
        header: 'Source',
        accessorKey: 'source',
        cell: ({ getValue }) => {
          const src = getValue() as string;
          return src ? (
            <Badge variant="secondary">{SOURCE_LABELS[src] ?? src}</Badge>
          ) : '-';
        },
        enableSorting: false,
        enableHiding: true,
      },
      {
        id: 'currentTitle',
        header: 'Current Title',
        accessorKey: 'currentTitle',
        cell: ({ getValue }) => getValue() || '-',
        enableSorting: false,
        enableHiding: true,
      },
      {
        id: 'country',
        header: 'Country',
        accessorKey: 'country',
        cell: ({ getValue }) => getValue() || '-',
        enableSorting: true,
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
        size: 60,
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
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDeletingCandidate(row.original)}
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
    [navigate],
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Candidates</h1>
        <p className="text-sm text-muted-foreground">Manage candidate profiles</p>
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
        onFiltersClear={() => clearFilters(['source'])}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        enableExport
        exportFilename="candidates"
        emptyState={{
          icon: Users,
          title: 'No candidates yet',
          description: 'Add your first candidate to get started.',
          action: { label: 'Add Candidate', onClick: () => setAddModalOpen(true) },
        }}
        storageKey="candidates-list"
        rowClassName={(c) => c.deletedAt ? 'bg-muted/30 text-muted-foreground' : undefined}
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
            <DataGridFilters filters={CANDIDATE_FILTERS} getFilter={getFilter} setFilter={setFilter} />
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Candidate
            </Button>
          </div>
        }
      />

      {/* Add Candidate Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <AddCandidateForm
            onClose={() => setAddModalOpen(false)}
            onSuccess={(id) => navigate(`/candidates/${id}`)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingCandidate}
        onOpenChange={(open) => !open && setDeletingCandidate(null)}
        title="Delete candidate"
        description={
          deletingCandidate
            ? `This will delete ${deletingCandidate.firstName} ${deletingCandidate.lastName}'s profile.`
            : ''
        }
        confirmLabel="Delete candidate"
        isPending={deleteMutation.isPending}
        onConfirm={() => deletingCandidate && deleteMutation.mutate(deletingCandidate.id)}
      />
    </div>
  );
}
