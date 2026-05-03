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
  type KanbanColumnState,
} from '@packages/ui';
import { ComplianceCalendar } from '../../../../components/composites';
import type { FilingRow } from './types';
import { FilingDetailDrawer } from './components/FilingDetailDrawer';
import {
  BulkReassignDialog,
  type BulkReassignSubmitPayload,
} from './components/BulkReassignDialog';
import {
  FILING_COLUMNS,
  ALL_FILING_COLUMN_KEYS,
  REQUIRED_FILING_COLUMN_KEYS,
} from './components/filingColumns';
import { ViewModeSwitcher, type ViewModeOption } from './components/ViewModeSwitcher';
import { FilingKanbanCard } from './components/FilingKanbanCard';
import { OverdueAlert } from './components/OverdueAlert';
import type { Filing } from '../../../../types';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { useComplianceFilingRows, useUpdateComplianceFiling } from '../../../../hooks/useComplianceFilings';
import { useFilingsList, type FilingsListBucket } from '../../../../hooks/useFilingsList';
import { useFilingsBucketInfinite } from '../../../../hooks/useFilingsBucket';
import { useFilingsSummary } from '../../../../hooks/useFilingsSummary';
import type { FilingListRow } from '../../../../hooks/useFilingsByDueWindow';

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

const LIST_PAGE_LIMIT = 25;

function statusTabToBucket(tab: StatusTab): FilingsListBucket | undefined {
  switch (tab) {
    case 'all':
      return undefined;
    case 'overdue':
      return 'overdue';
    case 'due-today':
      return 'due-today';
    case 'due-this-week':
      return 'due-this-week';
    case 'upcoming':
      return 'upcoming';
    case 'filed':
      return 'filed';
    default:
      return undefined;
  }
}

function rowToFilingRow(row: FilingListRow): FilingRow {
  const dueDate = row.dueDate ?? '';
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName ?? '—',
    lawId: row.lawId,
    lawCode: row.lawCode ?? '',
    // Rule name is not joined server-side today; fall back to the filing's own title.
    ruleName: row.title,
    dueDate,
    periodLabel: formatPeriodLabel(row.periodStart),
    handler: row.assigneeTeamId
      ? {
          id: row.assigneeTeamId,
          name: row.assigneeTeamName ?? '—',
          initials: initialsFromName(row.assigneeTeamName ?? ''),
        }
      : undefined,
    jurisdiction: (row.lawJurisdiction as Filing['jurisdiction']) ?? 'central',
    status: deriveBucketStatus(row),
    priority: mapPriority(row.priority),
    filedDate: row.completedAt ? row.completedAt.slice(0, 10) : undefined,
    notes: [],
    attachments: [],
    activity: [],
  };
}

function deriveBucketStatus(row: FilingListRow): Filing['status'] {
  if (row.status === 'completed') return 'filed';
  if (row.status === 'cancelled') return 'filed';
  if (!row.dueDate) return 'upcoming';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(row.dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'due-today';
  if (days <= 7) return 'due-this-week';
  return 'upcoming';
}

function formatPeriodLabel(periodStart: string | null | undefined): string {
  if (!periodStart) return '';
  const d = new Date(periodStart);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const PRIORITY_MAP: Record<string, FilingRow['priority']> = {
  urgent: 'critical',
  high: 'high',
  medium: 'normal',
  low: 'low',
};

function mapPriority(p: string): FilingRow['priority'] {
  return PRIORITY_MAP[p] ?? 'normal';
}

interface LoadMoreButtonProps {
  rendered: number;
  total: number;
  isFetching: boolean;
  onClick: () => void;
}

function LoadMoreButton({ rendered, total, isFetching, onClick }: LoadMoreButtonProps) {
  const remaining = Math.max(0, total - rendered);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isFetching || remaining === 0}
      className="mt-2 w-full px-3 py-2 text-[11px] uppercase tracking-eyebrow font-sans font-medium border border-rule text-ink-muted hover:text-ink hover:border-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {isFetching ? 'Loading…' : `Load more (${remaining} remaining)`}
    </button>
  );
}

export function FilingsPage() {
  const { summary, loading: summaryLoading } = useFilingsSummary();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [lawFilter, setLawFilter] = useState<string[]>([]);
  const [handlerFilter, setHandlerFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_FILING_COLUMN_KEYS);
  const [selectedFiling, setSelectedFiling] = useState<FilingRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);

  // Reset to page 1 whenever the filter shape changes — otherwise a user
  // who's on page 5 of "all" jumps to an empty page 5 of "overdue".
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusTab, search, clientFilter, lawFilter, handlerFilter]);

  // Server-paginated list view query. Driven by the current filter+sort+page
  // state. Bucket maps to dueBefore/dueAfter/notCompleted/status primitives;
  // client/law/team filters become structured `in` filters on the engine.
  const listQuery = useFilingsList({
    page,
    limit: LIST_PAGE_LIMIT,
    sort: 'dueDate:asc',
    search: search.trim() || undefined,
    bucket: statusTabToBucket(statusTab),
    clientIds: clientFilter.length > 0 ? clientFilter : undefined,
    lawIds: lawFilter.length > 0 ? lawFilter : undefined,
    assigneeTeamIds: handlerFilter.length > 0 ? handlerFilter : undefined,
  });

  const listRows = useMemo<FilingRow[]>(
    () => listQuery.rows.map(rowToFilingRow),
    [listQuery.rows],
  );

  // Kanban + calendar still depend on the legacy hook (PR-3b will migrate
  // them and retire useComplianceFilingRows). Filter-dropdown options also
  // come from this hook for now; option-source endpoints are a separate
  // follow-up.
  const legacy = useComplianceFilingRows();
  const updateFiling = useUpdateComplianceFiling();

  const clientOptions = legacy.clientOptions;
  const lawOptions = legacy.lawOptions;
  const handlers = legacy.handlers;

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

  const visibleIds = useMemo(() => new Set(listRows.map((f) => f.id)), [listRows]);
  const effectiveSelectedIds = useMemo(() => {
    const next = new Set<string>();
    for (const id of selectedIds) if (visibleIds.has(id)) next.add(id);
    return next;
  }, [selectedIds, visibleIds]);

  const selectedFilings = useMemo(
    () => listRows.filter((f) => effectiveSelectedIds.has(f.id)),
    [listRows, effectiveSelectedIds],
  );

  function applyReassign({ newHandlerId, notify, note }: BulkReassignSubmitPayload) {
    const newHandler = handlers.find((h) => h.id === newHandlerId);
    if (!newHandler) return;
    const targetIds = Array.from(effectiveSelectedIds);

    Promise.all(
      targetIds.map((id) =>
        updateFiling.mutateAsync({ id, data: { assigneeTeamId: newHandlerId, assigneeId: null } }),
      ),
    )
      .then(() => {
        setSelectedIds(new Set());
        setReassignOpen(false);
        listQuery.refetch();
        const count = targetIds.length;
        const noun = count === 1 ? 'filing' : 'filings';
        toast.success(`${count} ${noun} reassigned to ${newHandler.name}`, {
          description: notify
            ? `${newHandler.name.split(' ')[0]} will be notified${note ? ` with your note` : ''}.`
            : undefined,
          duration: 10_000,
        });
      })
      .catch(() => {
        toast.error('Failed to reassign filings');
      });
  }

  const onTimeRate = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const overdueClientCount = summary.overdueClientCount;

  const columnChooserItems = FILING_COLUMNS.map((c) => ({
    key: c.key,
    label: c.header,
    required: REQUIRED_FILING_COLUMN_KEYS.includes(c.key),
  }));

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: summary.total },
    { value: 'overdue' as const, label: 'Overdue', count: summary.overdue },
    { value: 'due-today' as const, label: 'Due today', count: summary.dueToday },
    { value: 'due-this-week' as const, label: 'This week', count: summary.dueThisWeek },
    { value: 'upcoming' as const, label: 'Upcoming', count: summary.upcoming },
    { value: 'filed' as const, label: 'Filed', count: summary.completed },
  ];

  // Kanban: each column fires its own paginated query against the same
  // /compliance-filings endpoint with a fixed bucket. Filters (search,
  // client/law/team) propagate to all 5 columns. `enabled` gates fetching to
  // when the kanban tab is actually visible — switching to list/calendar
  // doesn't keep these queries refetching, but cached pages survive so
  // returning to kanban is instant.
  const kanbanFilters = {
    search: search.trim() || undefined,
    clientIds: clientFilter.length > 0 ? clientFilter : undefined,
    lawIds: lawFilter.length > 0 ? lawFilter : undefined,
    assigneeTeamIds: handlerFilter.length > 0 ? handlerFilter : undefined,
    enabled: viewMode === 'kanban',
  };
  const overdueBucket = useFilingsBucketInfinite({ bucket: 'overdue', ...kanbanFilters });
  const dueTodayBucket = useFilingsBucketInfinite({ bucket: 'due-today', ...kanbanFilters });
  const dueThisWeekBucket = useFilingsBucketInfinite({ bucket: 'due-this-week', ...kanbanFilters });
  const upcomingBucket = useFilingsBucketInfinite({ bucket: 'upcoming', ...kanbanFilters });
  const filedBucket = useFilingsBucketInfinite({ bucket: 'filed', ...kanbanFilters });

  const bucketsByColumn: Record<string, ReturnType<typeof useFilingsBucketInfinite>> = {
    overdue: overdueBucket,
    'due-today': dueTodayBucket,
    'due-this-week': dueThisWeekBucket,
    upcoming: upcomingBucket,
    filed: filedBucket,
  };

  // Concatenate per-bucket rows in column order, stamping `columnId` from the
  // bucket key. We trust the server's bucket assignment over a client-side
  // dueDate recompute — `notCompleted + dueBefore=today-1` etc. are the
  // single source of truth (see useFilingsList.bucketToQueryParams).
  const kanbanCards: KanbanCardData[] = useMemo(() => {
    const out: KanbanCardData[] = [];
    for (const col of KANBAN_COLUMNS) {
      const bucket = bucketsByColumn[col.id];
      for (const row of bucket.rows) {
        const filingRow = rowToFilingRow(row);
        out.push({ ...filingRow, status: col.id as FilingRow['status'], id: filingRow.id, columnId: col.id });
      }
    }
    return out;
  }, [overdueBucket.rows, dueTodayBucket.rows, dueThisWeekBucket.rows, upcomingBucket.rows, filedBucket.rows]);

  const kanbanColumnState: Record<string, KanbanColumnState> = useMemo(() => {
    const state: Record<string, KanbanColumnState> = {};
    for (const col of KANBAN_COLUMNS) {
      const bucket = bucketsByColumn[col.id];
      state[col.id] = {
        total: bucket.total,
        isLoading: bucket.isLoading,
        footer: bucket.hasMore ? (
          <LoadMoreButton
            rendered={bucket.rows.length}
            total={bucket.total}
            isFetching={bucket.isFetchingNextPage}
            onClick={bucket.fetchNextPage}
          />
        ) : undefined,
      };
    }
    return state;
  }, [
    overdueBucket.rows.length, overdueBucket.total, overdueBucket.hasMore, overdueBucket.isLoading, overdueBucket.isFetchingNextPage,
    dueTodayBucket.rows.length, dueTodayBucket.total, dueTodayBucket.hasMore, dueTodayBucket.isLoading, dueTodayBucket.isFetchingNextPage,
    dueThisWeekBucket.rows.length, dueThisWeekBucket.total, dueThisWeekBucket.hasMore, dueThisWeekBucket.isLoading, dueThisWeekBucket.isFetchingNextPage,
    upcomingBucket.rows.length, upcomingBucket.total, upcomingBucket.hasMore, upcomingBucket.isLoading, upcomingBucket.isFetchingNextPage,
    filedBucket.rows.length, filedBucket.total, filedBucket.hasMore, filedBucket.isLoading, filedBucket.isFetchingNextPage,
  ]);

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
    updateFiling
      .mutateAsync({ id: event.cardId, data: { status: nextStatus } })
      .catch(() => toast.error('Failed to update filing status'));
  }

  function handleCalendarClick(filing: Filing) {
    const row = legacy.rows.find((f) => f.id === filing.id);
    if (row) setSelectedFiling(row);
  }

  const monthAnchor = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dueThisWeekCount = summary.dueToday + summary.dueThisWeek;
  const showOverdueAlert = !summaryLoading && summary.overdue > 0;
  const totalPages = listQuery.meta?.totalPages ?? 0;

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="filings" />}
        breadcrumb={['Workspace', 'Filings']}
        title="Filings"
        subtitle={
          summaryLoading ? (
            'Loading filings…'
          ) : (
            <>
              {summary.total} filings — {summary.overdue} overdue, {dueThisWeekCount} due this week.
            </>
          )
        }
        actions={<ViewModeSwitcher modes={VIEW_MODES} value={viewMode} onChange={setViewMode} />}
        alert={
          showOverdueAlert && (
            <OverdueAlert
              count={summary.overdue}
              clientCount={overdueClientCount}
              onShowOverdue={() => setStatusTab('overdue')}
            />
          )
        }
        kpis={[
          {
            label: 'Overdue',
            value: String(summary.overdue),
            unit: 'filings',
            delta: 'need action now',
            deltaTone: 'negative',
            accent: 'signal',
            sparklineData: [2, 3, 3, 4, 3, 4, summary.overdue],
            sparklineTone: 'signal',
          },
          {
            label: 'Due this week',
            value: String(dueThisWeekCount),
            unit: 'filings',
            delta: `${summary.dueToday} due today`,
            deltaTone: 'neutral',
            accent: 'due-soon',
            sparklineData: [5, 6, 7, 6, 7, 8, dueThisWeekCount],
            sparklineTone: 'due-soon',
          },
          {
            label: 'Filed',
            value: String(summary.completed),
            unit: 'completed',
            delta: `${onTimeRate}% on time`,
            deltaTone: 'positive',
            accent: 'filed',
            sparklineData: [2, 3, 3, 4, 4, 5, summary.completed],
            sparklineTone: 'filed',
          },
          {
            label: 'Total filings',
            value: String(summary.total),
            unit: 'this period',
            delta: `${summary.upcoming} upcoming`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [18, 19, 20, 21, 22, 23, summary.total],
            sparklineTone: 'authority',
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
                placeholder="Search filings…"
                wrapperClassName="min-w-[200px] max-w-xs flex-1"
              />
            }
            filters={
              <>
                <FilterPopover
                  label="Client"
                  options={clientOptions.map((c) => ({ value: c.value, label: c.label }))}
                  value={clientFilter}
                  onChange={(v) => setClientFilter(v as string[])}
                />
                <FilterPopover
                  label="Law"
                  options={lawOptions.map((l) => ({ value: l.value, label: l.label }))}
                  value={lawFilter}
                  onChange={(v) => setLawFilter(v as string[])}
                />
                <FilterPopover
                  label="Handler"
                  options={handlers.map((h) => ({ value: h.id, label: h.name }))}
                  value={handlerFilter}
                  onChange={(v) => setHandlerFilter(v as string[])}
                />
              </>
            }
            trailing={
              <>
                <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                  {listQuery.total > 0
                    ? `${(page - 1) * LIST_PAGE_LIMIT + 1}–${Math.min(page * LIST_PAGE_LIMIT, listQuery.total)} of ${listQuery.total}`
                    : '0 of 0'}
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
                  itemNoun="filing"
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
                        toast.message(`Export ${effectiveSelectedIds.size} filings (stub)`),
                    },
                  ]}
                />
              )}
            </AnimatePresence>
          )}

          {viewMode === 'list' && (
            <>
              <DataGridShell
                columns={FILING_COLUMNS}
                rows={listRows}
                getRowKey={(f) => f.id}
                onRowClick={(f) => setSelectedFiling(f)}
                visibleColumns={visibleColumns}
                onVisibleColumnsChange={setVisibleColumns}
                hideToolbar
                selectable
                selectedKeys={effectiveSelectedIds}
                onSelectionChange={setSelectedIds}
              />
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-3 py-3 border-t border-rule mt-2">
                  <span className="text-[11px] font-sans tabular-nums text-ink-soft">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-1 text-[11px] uppercase tracking-eyebrow font-sans font-medium border border-rule text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || listQuery.loading}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 text-[11px] uppercase tracking-eyebrow font-sans font-medium border border-rule text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || listQuery.loading}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {viewMode === 'kanban' && (
            <div className="mt-4">
              <KanbanBoard
                columns={KANBAN_COLUMNS}
                cards={kanbanCards}
                columnState={kanbanColumnState}
                onCardMove={handleCardMove}
                renderCard={(card) => {
                  const f = card as unknown as FilingRow;
                  return (
                    <FilingKanbanCard
                      filing={f}
                      onOpen={(row) => setSelectedFiling(row)}
                    />
                  );
                }}
              />
            </div>
          )}

          {viewMode === 'calendar' && (
            <div className="mt-4">
              <ComplianceCalendar
                filings={legacy.rows}
                month={monthAnchor}
                onFilingClick={handleCalendarClick}
              />
            </div>
          )}
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {selectedFiling && (
          <FilingDetailDrawer filing={selectedFiling} onClose={() => setSelectedFiling(null)} />
        )}
      </AnimatePresence>

      <BulkReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        filings={selectedFilings}
        handlers={handlers}
        onConfirm={applyReassign}
      />
    </>
  );
}
