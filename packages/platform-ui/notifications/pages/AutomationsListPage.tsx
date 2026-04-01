import { useMemo, useState } from 'react';
import { Zap, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  DataGrid, Badge, Button, useDataGridParams, ConfirmDialog,
  type ColumnDef,
} from '@packages/ui';
import { useAutomationRules, useDeleteAutomationRule, useToggleAutomationRule } from '../hooks';
import type { AutomationRule, TriggerType } from '../types';

const TRIGGER_LABELS: Record<TriggerType, string> = {
  event: 'Event',
  schedule_once: 'One-time Schedule',
  schedule_recurring: 'Recurring',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function TriggerSummary({ rule }: { rule: AutomationRule }) {
  if (rule.triggerType === 'event') {
    return (
      <div className="text-sm">
        <span className="text-muted-foreground">When </span>
        <span className="font-medium">{rule.eventName}</span>
        {rule.delayAmount && rule.delayUnit && (
          <span className="text-muted-foreground"> after {rule.delayAmount} {rule.delayUnit}</span>
        )}
      </div>
    );
  }

  const days = rule.scheduleDaysOfWeek;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">
        {rule.triggerType === 'schedule_recurring' ? 'Every ' : 'Once: '}
      </span>
      {days && days.length > 0 && days.length < 7 && (
        <span className="font-medium">{days.map((d) => DAY_LABELS[d]).join(', ')} </span>
      )}
      {rule.scheduleDateField && (
        <>
          <span className="text-muted-foreground">
            {rule.scheduleDateAmounts?.join(', ')} {rule.scheduleDateUnit} {rule.scheduleDateOperator}{' '}
          </span>
          <span className="font-medium">{rule.scheduleDateField}</span>
        </>
      )}
      {!rule.scheduleDateField && rule.scheduleEntityType && (
        <span className="font-medium">{rule.scheduleEntityType}</span>
      )}
    </div>
  );
}

function ActionsSummary({ rule }: { rule: AutomationRule }) {
  if (!rule.actions || rule.actions.length === 0) {
    return <span className="text-sm text-muted-foreground">No actions</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {rule.actions.map((action, i) => (
        <Badge key={i} variant="secondary" className="text-xs">
          {action.type.replace(/_/g, ' ')}
        </Badge>
      ))}
    </div>
  );
}

export function AutomationsListPage() {
  const [deleting, setDeleting] = useState<AutomationRule | null>(null);

  const {
    page, pageSize, search, sort, order,
    setPage, setPageSize, setSearch, setSort,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc' });

  const { data, isLoading, isError, refetch } = useAutomationRules({
    page, limit: pageSize, search: search || undefined,
    sort: sort as 'name' | 'createdAt' | undefined, order,
  });

  const deleteMutation = useDeleteAutomationRule({ onSuccess: () => setDeleting(null) });
  const toggleMutation = useToggleAutomationRule();

  const columns = useMemo<ColumnDef<AutomationRule, unknown>[]>(() => [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-foreground">{row.original.name}</span>
          <TriggerSummary rule={row.original} />
        </div>
      ),
      enableSorting: true,
    },
    {
      id: 'triggerType',
      header: 'Trigger',
      accessorKey: 'triggerType',
      cell: ({ getValue }) => {
        const type = getValue() as TriggerType;
        return <Badge variant="outline">{TRIGGER_LABELS[type] ?? type}</Badge>;
      },
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => <ActionsSummary rule={row.original} />,
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: 'isActive',
      header: 'Active',
      accessorKey: 'isActive',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => toggleMutation.mutate({ id: row.original.id, isActive: !row.original.isActive })}
          disabled={toggleMutation.isPending}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            row.original.isActive ? 'bg-primary' : 'bg-muted'
          }`}
          aria-label={row.original.isActive ? 'Deactivate' : 'Activate'}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            row.original.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`} />
        </button>
      ),
      enableSorting: false,
      size: 70,
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
      id: 'rowActions',
      header: '',
      size: 80,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <a
            href={`/automations/${row.original.id}/edit`}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </a>
          <button type="button" onClick={() => setDeleting(row.original)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ], [toggleMutation]);

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
        searchPlaceholder="Search rules..."
        isLoading={isLoading} isError={isError} onRetry={refetch}
        emptyState={{
          icon: Zap,
          title: 'No automation rules yet',
          description: 'Create your first automation rule to trigger actions on events or schedules.',
          action: { label: 'Create Rule', onClick: () => { window.location.href = '/automations/create'; } },
        }}
        storageKey="automations-list"
        toolbarActions={
          <Button size="sm" onClick={() => { window.location.href = '/automations/create'; }}>
            <Plus className="h-4 w-4 mr-1" />
            Create Rule
          </Button>
        }
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete automation rule"
        description={deleting ? `Delete "${deleting.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
