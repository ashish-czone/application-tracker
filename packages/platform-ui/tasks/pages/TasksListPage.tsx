import { useMemo, useState } from 'react';
import { CheckSquare, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  DataGrid, Badge, Button, useDataGridParams,
  Dialog, DialogContent, ConfirmDialog,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  type ColumnDef, type DataGridFilter,
} from '@packages/ui';
import { useTasks, useDeleteTask, useTransitionTask, useTaskTransitions } from '../hooks';
import { AddTaskForm } from '../components/AddTaskForm';
import { EditTaskForm } from '../components/EditTaskForm';
import type { Task } from '../types';

const STATUS_CONFIG: Record<string, { label: string; color: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  open: { label: 'Open', color: '#6B7280', variant: 'secondary' },
  in_progress: { label: 'In Progress', color: '#3B82F6', variant: 'default' },
  done: { label: 'Done', color: '#10B981', variant: 'default' },
  cancelled: { label: 'Cancelled', color: '#EF4444', variant: 'destructive' },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  low: { label: 'Low', variant: 'outline' },
  medium: { label: 'Medium', variant: 'secondary' },
  high: { label: 'High', variant: 'default' },
  urgent: { label: 'Urgent', variant: 'destructive' },
};

export function TasksListPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [transitioningTaskId, setTransitioningTaskId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const {
    page, pageSize, search, sort, order,
    setPage, setPageSize, setSearch, setSort,
    getFilter, setFilter, clearFilters,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc' });

  const statusFilter = getFilter('status');
  const priorityFilter = getFilter('priority');

  const deleteMutation = useDeleteTask({ onSuccess: () => setDeletingTask(null) });
  const transitionMutation = useTransitionTask();
  const { data: transitions } = useTaskTransitions(transitioningTaskId);

  const { data, isLoading, isError, refetch } = useTasks({
    page,
    limit: pageSize,
    search: search || undefined,
    sort: sort || undefined,
    order,
    status: statusFilter,
    priority: priorityFilter,
    includeDeleted: showDeleted,
  });

  const columns = useMemo<ColumnDef<Task, unknown>[]>(
    () => [
      {
        id: 'title',
        header: 'Title',
        accessorKey: 'title',
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{row.original.title}</span>
              {row.original.deletedAt && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Deleted</Badge>
              )}
            </div>
            {row.original.description && (
              <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                {row.original.description}
              </div>
            )}
          </div>
        ),
        enableSorting: true,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => {
          const task = row.original;
          const config = STATUS_CONFIG[task.status] ?? { label: task.status, variant: 'outline' as const };
          const isTerminal = task.status === 'done' || task.status === 'cancelled';

          if (isTerminal || task.deletedAt) {
            return (
              <Badge
                variant={config.variant}
                style={config.color ? { backgroundColor: `${config.color}20`, color: config.color, borderColor: `${config.color}40` } : undefined}
              >
                {config.label}
              </Badge>
            );
          }

          return (
            <DropdownMenu
              onOpenChange={(open) => {
                if (open) setTransitioningTaskId(task.id);
                else setTransitioningTaskId(null);
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer"
                >
                  <Badge
                    variant={config.variant}
                    style={config.color ? { backgroundColor: `${config.color}20`, color: config.color, borderColor: `${config.color}40` } : undefined}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {config.label} ▾
                  </Badge>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {transitions && transitioningTaskId === task.id ? (
                  transitions.length > 0 ? (
                    transitions.map((t) => (
                      <DropdownMenuItem
                        key={t.key}
                        onClick={() => transitionMutation.mutate({ id: task.id, data: { toState: t.toState } })}
                      >
                        {t.label}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>No transitions available</DropdownMenuItem>
                  )
                ) : (
                  <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
      {
        id: 'priority',
        header: 'Priority',
        accessorKey: 'priority',
        cell: ({ getValue }) => {
          const priority = getValue() as string;
          const config = PRIORITY_CONFIG[priority] ?? { label: priority, variant: 'outline' as const };
          return <Badge variant={config.variant}>{config.label}</Badge>;
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        id: 'dueDate',
        header: 'Due Date',
        accessorKey: 'dueDate',
        cell: ({ getValue }) => {
          const date = getValue() as string | null;
          if (!date) return <span className="text-muted-foreground">—</span>;
          const d = new Date(date + 'T00:00:00');
          const isOverdue = d < new Date() && !['done', 'cancelled'].includes('');
          return (
            <span className={isOverdue ? 'text-destructive font-medium' : ''}>
              {format(d, 'MMM d, yyyy')}
            </span>
          );
        },
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
        size: 80,
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.deletedAt) return null;
          return (
            <div className="flex items-center gap-1 justify-end">
              <button
                type="button"
                onClick={() => setEditingTask(row.original)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label={`Edit ${row.original.title}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingTask(row.original)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label={`Delete ${row.original.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [transitions, transitioningTaskId, transitionMutation],
  );

  const activeFilters = useMemo<DataGridFilter[]>(() => {
    const filters: DataGridFilter[] = [];
    if (statusFilter) {
      const config = STATUS_CONFIG[statusFilter];
      filters.push({ key: 'status', label: 'Status', value: config?.label ?? statusFilter });
    }
    if (priorityFilter) {
      const config = PRIORITY_CONFIG[priorityFilter];
      filters.push({ key: 'priority', label: 'Priority', value: config?.label ?? priorityFilter });
    }
    return filters;
  }, [statusFilter, priorityFilter]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Tasks</h1>
        <p className="text-sm text-muted-foreground">Manage and track tasks</p>
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
        searchPlaceholder="Search by title..."
        activeFilters={activeFilters}
        onFilterRemove={(key) => setFilter(key, undefined)}
        onFiltersClear={() => clearFilters(['status', 'priority'])}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyState={{
          icon: CheckSquare,
          title: 'No tasks yet',
          description: 'Create your first task to get started.',
          action: { label: 'Add Task', onClick: () => setAddModalOpen(true) },
        }}
        storageKey="tasks-list"
        rowClassName={(task) => task.deletedAt ? 'bg-muted/30 text-muted-foreground' : undefined}
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
            <select
              value={statusFilter || ''}
              onChange={(e) => setFilter('status', e.target.value || undefined)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={priorityFilter || ''}
              onChange={(e) => setFilter('priority', e.target.value || undefined)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          </div>
        }
        renderCard={(task) => (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium text-foreground">{task.title}</div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={STATUS_CONFIG[task.status]?.variant ?? 'outline'}
                  style={STATUS_CONFIG[task.status]?.color ? {
                    backgroundColor: `${STATUS_CONFIG[task.status].color}20`,
                    color: STATUS_CONFIG[task.status].color,
                    borderColor: `${STATUS_CONFIG[task.status].color}40`,
                  } : undefined}
                >
                  {STATUS_CONFIG[task.status]?.label ?? task.status}
                </Badge>
                <button
                  type="button"
                  onClick={() => setEditingTask(task)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingTask(task)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {task.description && (
              <div className="text-sm text-muted-foreground line-clamp-2">{task.description}</div>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Badge variant={PRIORITY_CONFIG[task.priority]?.variant ?? 'outline'} className="text-[10px]">
                {PRIORITY_CONFIG[task.priority]?.label ?? task.priority}
              </Badge>
              {task.dueDate && <span>Due {format(new Date(task.dueDate + 'T00:00:00'), 'MMM d, yyyy')}</span>}
              <span>Created {format(new Date(task.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>
        )}
      />

      {/* Add Task Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <AddTaskForm onClose={() => setAddModalOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Task Modal */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="sm:max-w-lg">
          {editingTask && (
            <EditTaskForm task={editingTask} onClose={() => setEditingTask(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="Delete task"
        description={
          deletingTask
            ? `This will delete the task "${deletingTask.title}".`
            : ''
        }
        confirmLabel="Delete task"
        isPending={deleteMutation.isPending}
        onConfirm={() => deletingTask && deleteMutation.mutate(deletingTask.id)}
      />
    </div>
  );
}
