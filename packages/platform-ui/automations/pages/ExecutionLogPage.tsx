import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  DataGrid, Badge,
  useDataGridParams,
  type ColumnDef,
} from '@packages/ui';
import { useAutomationExecutions } from '../hooks';
import type { AutomationExecution } from '../types';

const STATUS_FILTER_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Success', value: 'success' },
  { label: 'Error', value: 'error' },
] as const;

export function ExecutionLogPage() {
  const [statusFilter, setStatusFilter] = useState<'success' | 'error' | ''>('');

  const {
    page, pageSize, sort, order,
    setPage, setPageSize, setSort,
  } = useDataGridParams({ defaultSort: 'executedAt', defaultOrder: 'desc' });

  const { data, isLoading, isError, refetch } = useAutomationExecutions({
    page,
    limit: pageSize,
    status: statusFilter || undefined,
    sort: sort as 'executedAt' | undefined,
    order,
  });

  const columns = useMemo<ColumnDef<AutomationExecution, unknown>[]>(() => [
    {
      id: 'ruleName',
      header: 'Rule',
      accessorKey: 'ruleName',
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground">{getValue() as string}</span>
      ),
      enableSorting: false,
    },
    {
      id: 'actionType',
      header: 'Action',
      accessorKey: 'actionType',
      cell: ({ getValue }) => (
        <Badge variant="secondary" className="text-xs">
          {(getValue() as string).replace(/_/g, ' ')}
        </Badge>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'entityType',
      header: 'Entity',
      cell: ({ row }) => (
        <div className="text-sm">
          <span className="text-foreground">{row.original.entityType}</span>
          <span className="text-muted-foreground ml-1 text-xs font-mono">{row.original.entityId.slice(0, 8)}</span>
        </div>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue() as 'success' | 'error';
        return (
          <Badge variant={status === 'success' ? 'default' : 'destructive'} className="text-xs">
            {status}
          </Badge>
        );
      },
      enableSorting: false,
      size: 90,
    },
    {
      id: 'errorMessage',
      header: 'Error',
      accessorKey: 'errorMessage',
      cell: ({ getValue }) => {
        const msg = getValue() as string | null;
        if (!msg) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-sm text-destructive truncate block max-w-[300px]" title={msg}>
            {msg}
          </span>
        );
      },
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'executedAt',
      header: 'Executed',
      accessorKey: 'executedAt',
      cell: ({ getValue }) => {
        const date = new Date(getValue() as string);
        return (
          <span className="text-sm text-muted-foreground" title={format(date, 'PPpp')}>
            {formatDistanceToNow(date, { addSuffix: true })}
          </span>
        );
      },
      enableSorting: true,
    },
  ], []);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setStatusFilter(opt.value as typeof statusFilter);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              statusFilter === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {opt.label}
          </button>
        ))}
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
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyState={{
          icon: History,
          title: 'No executions yet',
          description: 'Automation execution logs will appear here when rules are triggered.',
        }}
        storageKey="automation-executions"
      />
    </div>
  );
}
