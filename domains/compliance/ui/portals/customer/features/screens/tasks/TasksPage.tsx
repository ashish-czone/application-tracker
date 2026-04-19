import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { List, Columns3, CalendarDays, Download, UserPlus } from 'lucide-react';
import {
  DataGridShell,
  FilterPopover,
  ColumnChooser,
  ActiveFilterChips,
  BulkActionBar,
  CoarseTabs,
  KanbanBoard,
  SearchInput,
  ScreenLayout,
  ToolbarRow,
  toast,
  type ActiveFilter,
  type KanbanColumnDef,
  type KanbanCardData,
} from '@packages/ui';
import { useEntityHooks } from '@packages/entity-engine-ui';
import { ComplianceCalendar } from '../../../../../shared';
import type { FilingRow } from '../filings/data/filingsMock';
import { FilingDetailDrawer } from '../filings/components/FilingDetailDrawer';
import {
  BulkReassignDialog,
  type BulkReassignSubmitPayload,
} from '../filings/components/BulkReassignDialog';
import {
  FILING_COLUMNS,
  ALL_FILING_COLUMN_KEYS,
  REQUIRED_FILING_COLUMN_KEYS,
} from '../filings/components/filingColumns';
import { ViewModeSwitcher, type ViewModeOption } from '../filings/components/ViewModeSwitcher';
import { FilingKanbanCard } from '../filings/components/FilingKanbanCard';
import { OverdueAlert } from '../filings/components/OverdueAlert';
import type { Filing } from '../../../../../shared/types';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { useComplianceTaskRows } from './api/useComplianceTasks';

type StatusTab = 'all' | Filing['status'];
type ViewMode = 'list' | 'kanban' | 'calendar';

const VIEW_MODES: ViewModeOption<ViewMode>[] = [
  { key: 'list', label: 'List view', icon: List },
  { key: 'kanban', label: 'Board view', icon: Columns3 },
  { key: 'calendar', label: 'Calendar view', icon: CalendarDays },
];

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: 'overdue', label: 'Overdue', color: 'hsl(var(--signal))' },
  { id: 'due-today', label: 'Due Today', color: 'hsl(var(--due-soon))' },
  { id: 'due-this-week', label: 'This Week', color: 'hsl(var(--authority))' },
  { id: 'upcoming', label: 'Upcoming', color: 'hsl(var(--ink-muted))' },
  { id: 'filed', label: 'Filed', color: 'hsl(var(--filed))' },
];

export function TasksPage() {
  const { rows, loading, handlers, clientOptions, lawOptions } = useComplianceTaskRows();
  const tasksHooks = useEntityHooks('tasks');
  const updateTask = tasksHooks.useUpdate();

  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [lawFilter, setLawFilter] = useState<string[]>([]);
  const [handlerFilter, setHandlerFilter] = useState<string[]>([]);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_FILING_COLUMN_KEYS);
  const [selectedTask, setSelectedTask] = useState<FilingRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((f) => {
      if (statusTab !== 'all' && f.status !== statusTab) return false;
      if (clientFilter.length > 0 && !clientFilter.includes(f.clientId)) return false;
      if (lawFilter.length > 0 && !lawFilter.includes(f.lawId)) return false;
      if (handlerFilter.length > 0 && (!f.handler || !handlerFilter.includes(f.handler.id)))
        return false;
      if (
        q &&
        !`${f.lawCode} ${f.ruleName} ${f.clientName} ${f.periodLabel}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, statusTab, clientFilter, lawFilter, handlerFilter, search]);

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const chips: ActiveFilter[] = [];
    for (const key of clientFilter) {
      const opt = clientOptions.find((o) => o.value === key);
      chips.push({
        key: `client:${key}`,
        group: 'Client',
        value: opt?.label ?? key,
        onRemove: () => setClientFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    for (const key of lawFilter) {
      const opt = lawOptions.find((o) => o.value === key);
      chips.push({
        key: `law:${key}`,
        group: 'Law',
        value: opt?.label ?? key,
        onRemove: () => setLawFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    for (const key of handlerFilter) {
      const opt = handlers.find((h) => h.id === key);
      chips.push({
        key: `handler:${key}`,
        group: 'Handler',
        value: opt?.name ?? key,
        onRemove: () => setHandlerFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    return chips;
  }, [clientFilter, lawFilter, handlerFilter, clientOptions, lawOptions, handlers]);

  const clearAll = () => {
    setClientFilter([]);
    setLawFilter([]);
    setHandlerFilter([]);
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusTab, clientFilter, lawFilter, handlerFilter, search]);

  const visibleIds = useMemo(() => new Set(filtered.map((f) => f.id)), [filtered]);
  const effectiveSelectedIds = useMemo(() => {
    const next = new Set<string>();
    for (const id of selectedIds) if (visibleIds.has(id)) next.add(id);
    return next;
  }, [selectedIds, visibleIds]);

  const selectedTasks = useMemo(
    () => rows.filter((f) => effectiveSelectedIds.has(f.id)),
    [rows, effectiveSelectedIds],
  );

  function applyReassign({ newHandlerId, notify, note }: BulkReassignSubmitPayload) {
    const newHandler = handlers.find((h) => h.id === newHandlerId);
    if (!newHandler) return;
    const targetIds = Array.from(effectiveSelectedIds);

    Promise.all(
      targetIds.map((id) =>
        updateTask.mutateAsync({ id, data: { assigneeTeamId: newHandlerId, assigneeId: null } }),
      ),
    )
      .then(() => {
        setSelectedIds(new Set());
        setReassignOpen(false);
        const count = targetIds.length;
        const noun = count === 1 ? 'task' : 'tasks';
        toast.success(`${count} ${noun} reassigned to ${newHandler.name}`, {
          description: notify
            ? `${newHandler.name.split(' ')[0]} will be notified${note ? ` with your note` : ''}.`
            : undefined,
          duration: 10_000,
        });
      })
      .catch(() => {
        toast.error('Failed to reassign tasks');
      });
  }

  const totalTasks = rows.length;
  const statusCounts = useMemo(() => {
    const counts = { overdue: 0, 'due-today': 0, 'due-this-week': 0, upcoming: 0, filed: 0 };
    for (const r of rows) {
      if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
    }
    return counts;
  }, [rows]);

  const overdueCount = statusCounts.overdue;
  const dueThisWeekCount = statusCounts['due-today'] + statusCounts['due-this-week'];
  const filedCount = statusCounts.filed;
  const onTimeRate = totalTasks > 0 ? Math.round((filedCount / totalTasks) * 100) : 0;

  const overdueClientCount = useMemo(
    () => new Set(rows.filter((f) => f.status === 'overdue').map((f) => f.clientId)).size,
    [rows],
  );

  const clientOptionsWithCounts = clientOptions.map((c) => ({
    ...c,
    count: rows.filter((f) => f.clientId === c.value).length,
  }));

  const lawOptionsWithCounts = lawOptions.map((l) => ({
    ...l,
    count: rows.filter((f) => f.lawId === l.value).length,
  }));

  const handlerOptionsWithCounts = handlers.map((h) => ({
    value: h.id,
    label: h.name,
    count: rows.filter((f) => f.handler?.id === h.id).length,
  }));

  const columnChooserItems = FILING_COLUMNS.map((c) => ({
    key: c.key,
    label: c.header,
    required: REQUIRED_FILING_COLUMN_KEYS.includes(c.key),
  }));

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalTasks },
    { value: 'overdue' as const, label: 'Overdue', count: statusCounts.overdue },
    { value: 'due-today' as const, label: 'Due today', count: statusCounts['due-today'] },
    { value: 'due-this-week' as const, label: 'This week', count: statusCounts['due-this-week'] },
    { value: 'upcoming' as const, label: 'Upcoming', count: statusCounts.upcoming },
    { value: 'filed' as const, label: 'Filed', count: statusCounts.filed },
  ];

  const kanbanCards: KanbanCardData[] = useMemo(
    () => filtered.map((f) => ({ ...f, id: f.id, columnId: f.status })),
    [filtered],
  );

  function handleCardMove(event: {
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    toIndex: number;
  }) {
    const toFiled = event.toColumnId === 'filed';
    const fromFiled = event.fromColumnId === 'filed';
    if (!toFiled && !fromFiled) return;
    const nextStatus = toFiled ? 'completed' : 'pending';
    updateTask
      .mutateAsync({ id: event.cardId, data: { status: nextStatus } })
      .catch(() => toast.error('Failed to update task status'));
  }

  function handleCalendarClick(filing: Filing) {
    const row = rows.find((f) => f.id === filing.id);
    if (row) setSelectedTask(row);
  }

  const monthAnchor = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="tasks" />}
        breadcrumb={['Workspace', 'Tasks']}
        title="Tasks"
        subtitle={
          loading ? (
            'Loading tasks…'
          ) : (
            <>
              {totalTasks} tasks across {clientOptions.length} clients — {overdueCount} overdue,{' '}
              {dueThisWeekCount} due this week.
            </>
          )
        }
        actions={<ViewModeSwitcher modes={VIEW_MODES} value={viewMode} onChange={setViewMode} />}
        alert={
          overdueCount > 0 && (
            <OverdueAlert
              count={overdueCount}
              clientCount={overdueClientCount}
              onShowOverdue={() => setStatusTab('overdue')}
            />
          )
        }
        kpis={[
          {
            label: 'Overdue',
            value: String(overdueCount),
            unit: 'tasks',
            delta: `${rows.filter((f) => f.status === 'overdue' && f.priority === 'critical').length} critical`,
            deltaTone: 'negative',
            accent: 'signal',
            sparklineData: [2, 3, 3, 4, 3, 4, overdueCount],
            sparklineTone: 'signal',
            footnote: 'need action now',
          },
          {
            label: 'Due this week',
            value: String(dueThisWeekCount),
            unit: 'tasks',
            delta: `${statusCounts['due-today']} due today`,
            deltaTone: 'neutral',
            accent: 'due-soon',
            sparklineData: [5, 6, 7, 6, 7, 8, dueThisWeekCount],
            sparklineTone: 'due-soon',
            footnote: 'across all clients',
          },
          {
            label: 'Filed this month',
            value: String(filedCount),
            unit: 'completed',
            delta: `${onTimeRate}% on time`,
            deltaTone: 'positive',
            accent: 'filed',
            sparklineData: [2, 3, 3, 4, 4, 5, filedCount],
            sparklineTone: 'filed',
            footnote: `${onTimeRate}% on time`,
          },
          {
            label: 'Total tasks',
            value: String(totalTasks),
            unit: 'this period',
            delta: `${statusCounts.upcoming} upcoming`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [18, 19, 20, 21, 22, 23, totalTasks],
            sparklineTone: 'authority',
            footnote: `${clientOptions.length} clients`,
          },
        ]}
      >
        <section className="mt-10">
          <CoarseTabs tabs={statusTabs} value={statusTab} onChange={setStatusTab} animated />

          <ToolbarRow
            search={
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                wrapperClassName="min-w-[200px] max-w-xs flex-1"
              />
            }
            filters={
              <>
                <FilterPopover
                  label="Client"
                  options={clientOptionsWithCounts}
                  value={clientFilter}
                  onChange={(v) => setClientFilter(v as string[])}
                />
                <FilterPopover
                  label="Law"
                  options={lawOptionsWithCounts}
                  value={lawFilter}
                  onChange={(v) => setLawFilter(v as string[])}
                />
                <FilterPopover
                  label="Handler"
                  options={handlerOptionsWithCounts}
                  value={handlerFilter}
                  onChange={(v) => setHandlerFilter(v as string[])}
                />
              </>
            }
            trailing={
              <>
                <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                  {filtered.length} of {totalTasks}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-[5px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-ink-soft bg-paper-raised hover:border-ink hover:text-ink transition-colors"
                  aria-label="Export"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Export</span>
                </button>
                {viewMode === 'list' && (
                  <ColumnChooser
                    columns={columnChooserItems}
                    visible={visibleColumns}
                    onChange={setVisibleColumns}
                  />
                )}
              </>
            }
          />

          <ActiveFilterChips filters={activeFilters} onClearAll={clearAll} />

          {viewMode === 'list' && (
            <AnimatePresence>
              {effectiveSelectedIds.size > 0 && (
                <BulkActionBar
                  count={effectiveSelectedIds.size}
                  itemNoun="task"
                  onClear={() => setSelectedIds(new Set())}
                  actions={[
                    {
                      label: 'Reassign',
                      icon: UserPlus,
                      onClick: () => setReassignOpen(true),
                    },
                    {
                      label: 'Export',
                      icon: Download,
                      onClick: () =>
                        toast.message(`Export ${effectiveSelectedIds.size} tasks (stub)`),
                    },
                  ]}
                />
              )}
            </AnimatePresence>
          )}

          {viewMode === 'list' && (
            <DataGridShell
              columns={FILING_COLUMNS}
              rows={filtered}
              getRowKey={(f) => f.id}
              onRowClick={(f) => setSelectedTask(f)}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={setVisibleColumns}
              hideToolbar
              selectable
              selectedKeys={effectiveSelectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}

          {viewMode === 'kanban' && (
            <div className="mt-4">
              <KanbanBoard
                columns={KANBAN_COLUMNS}
                cards={kanbanCards}
                onCardMove={handleCardMove}
                renderCard={(card) => {
                  const f = card as unknown as FilingRow;
                  return (
                    <FilingKanbanCard
                      filing={f}
                      onOpen={(row) =>
                        setSelectedTask(rows.find((r) => r.id === row.id) ?? null)
                      }
                    />
                  );
                }}
              />
            </div>
          )}

          {viewMode === 'calendar' && (
            <div className="mt-4">
              <ComplianceCalendar
                filings={filtered}
                month={monthAnchor}
                onFilingClick={handleCalendarClick}
              />
            </div>
          )}
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {selectedTask && (
          <FilingDetailDrawer filing={selectedTask} onClose={() => setSelectedTask(null)} />
        )}
      </AnimatePresence>

      <BulkReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        filings={selectedTasks}
        handlers={handlers}
        onConfirm={applyReassign}
      />
    </>
  );
}
