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
import { ComplianceCalendar } from '../../../../../shared';
import {
  MOCK_FILING_ROWS,
  FILING_STATUS_COUNTS,
  FILINGS_TODAY,
  HANDLER_OPTIONS,
  CLIENT_OPTIONS,
  LAW_OPTIONS,
  type FilingRow,
} from './data/filingsMock';
import { MOCK_HANDLERS } from '../../console-preview/mockData';
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
import type { Filing } from '../../../../../shared/types';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

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

export function FilingsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [lawFilter, setLawFilter] = useState<string[]>([]);
  const [handlerFilter, setHandlerFilter] = useState<string[]>([]);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_FILING_COLUMN_KEYS);
  const [filingRows, setFilingRows] = useState<FilingRow[]>(MOCK_FILING_ROWS);
  const [selectedFiling, setSelectedFiling] = useState<FilingRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filingRows.filter((f) => {
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
  }, [filingRows, statusTab, clientFilter, lawFilter, handlerFilter, search]);

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const chips: ActiveFilter[] = [];
    for (const key of clientFilter) {
      const opt = CLIENT_OPTIONS.find((o) => o.value === key);
      chips.push({
        key: `client:${key}`,
        group: 'Client',
        value: opt?.label ?? key,
        onRemove: () => setClientFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    for (const key of lawFilter) {
      const opt = LAW_OPTIONS.find((o) => o.value === key);
      chips.push({
        key: `law:${key}`,
        group: 'Law',
        value: opt?.label ?? key,
        onRemove: () => setLawFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    for (const key of handlerFilter) {
      const opt = HANDLER_OPTIONS.find((o) => o.value === key);
      chips.push({
        key: `handler:${key}`,
        group: 'Handler',
        value: opt?.label ?? key,
        onRemove: () => setHandlerFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    return chips;
  }, [clientFilter, lawFilter, handlerFilter]);

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

  const selectedFilings = useMemo(
    () => filingRows.filter((f) => effectiveSelectedIds.has(f.id)),
    [filingRows, effectiveSelectedIds],
  );

  function applyReassign({ newHandlerId, notify, note }: BulkReassignSubmitPayload) {
    const newHandler = MOCK_HANDLERS.find((h) => h.id === newHandlerId);
    if (!newHandler) return;

    const targetIds = new Set(effectiveSelectedIds);
    const before = new Map<string, FilingRow['handler']>();
    for (const f of filingRows) {
      if (targetIds.has(f.id)) before.set(f.id, f.handler);
    }

    setFilingRows((prev) =>
      prev.map((f) => (targetIds.has(f.id) ? { ...f, handler: newHandler } : f)),
    );
    setSelectedIds(new Set());
    setReassignOpen(false);

    const count = targetIds.size;
    const noun = count === 1 ? 'filing' : 'filings';
    toast.success(`${count} ${noun} reassigned to ${newHandler.name}`, {
      description: notify
        ? `${newHandler.name.split(' ')[0]} will be notified${note ? ` with your note` : ''}.`
        : undefined,
      duration: 10_000,
      action: {
        label: 'Undo',
        onClick: () => {
          setFilingRows((prev) =>
            prev.map((f) => (before.has(f.id) ? { ...f, handler: before.get(f.id) } : f)),
          );
          toast.message(`Reassignment of ${count} ${noun} reverted`);
        },
      },
    });
  }

  const totalFilings = MOCK_FILING_ROWS.length;
  const overdueCount = FILING_STATUS_COUNTS.overdue;
  const dueThisWeekCount =
    FILING_STATUS_COUNTS['due-today'] + FILING_STATUS_COUNTS['due-this-week'];
  const filedCount = FILING_STATUS_COUNTS.filed;
  const onTimeRate = Math.round(
    (MOCK_FILING_ROWS.filter((f) => f.status === 'filed').length / totalFilings) * 100,
  );

  const overdueClientCount = useMemo(
    () =>
      new Set(MOCK_FILING_ROWS.filter((f) => f.status === 'overdue').map((f) => f.clientId)).size,
    [],
  );

  const clientOptions = CLIENT_OPTIONS.map((c) => ({
    ...c,
    count: MOCK_FILING_ROWS.filter((f) => f.clientId === c.value).length,
  }));

  const lawOptions = LAW_OPTIONS.map((l) => ({
    ...l,
    count: MOCK_FILING_ROWS.filter((f) => f.lawId === l.value).length,
  }));

  const handlerOptions = HANDLER_OPTIONS.map((h) => ({
    ...h,
    count: MOCK_FILING_ROWS.filter((f) => f.handler?.id === h.value).length,
  }));

  const columnChooserItems = FILING_COLUMNS.map((c) => ({
    key: c.key,
    label: c.header,
    required: REQUIRED_FILING_COLUMN_KEYS.includes(c.key),
  }));

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalFilings },
    { value: 'overdue' as const, label: 'Overdue', count: FILING_STATUS_COUNTS.overdue },
    {
      value: 'due-today' as const,
      label: 'Due today',
      count: FILING_STATUS_COUNTS['due-today'],
    },
    {
      value: 'due-this-week' as const,
      label: 'This week',
      count: FILING_STATUS_COUNTS['due-this-week'],
    },
    { value: 'upcoming' as const, label: 'Upcoming', count: FILING_STATUS_COUNTS.upcoming },
    { value: 'filed' as const, label: 'Filed', count: FILING_STATUS_COUNTS.filed },
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
    setFilingRows((prev) => {
      const card = prev.find((f) => f.id === event.cardId);
      if (!card) return prev;

      const moved = { ...card, status: event.toColumnId as Filing['status'] };
      const without = prev.filter((f) => f.id !== event.cardId);

      let seen = 0;
      let insertAt = without.length;
      for (let i = 0; i < without.length; i++) {
        if (without[i].status === event.toColumnId) {
          if (seen === event.toIndex) {
            insertAt = i;
            break;
          }
          seen++;
        }
      }

      without.splice(insertAt, 0, moved);
      return without;
    });
  }

  function handleCalendarFilingClick(filing: Filing) {
    const row = filingRows.find((f) => f.id === filing.id);
    if (row) setSelectedFiling(row);
  }

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="filings" />}
        breadcrumb={['Workspace', 'Filings']}
        title="Filings"
        subtitle={
          <>
            {totalFilings} filings across {CLIENT_OPTIONS.length} clients — {overdueCount} overdue,{' '}
            {dueThisWeekCount} due this week.
          </>
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
            unit: 'filings',
            delta: `${MOCK_FILING_ROWS.filter((f) => f.status === 'overdue' && f.priority === 'critical').length} critical`,
            deltaTone: 'negative',
            accent: 'signal',
            sparklineData: [2, 3, 3, 4, 3, 4, overdueCount],
            sparklineTone: 'signal',
            footnote: 'need action now',
          },
          {
            label: 'Due this week',
            value: String(dueThisWeekCount),
            unit: 'filings',
            delta: `${FILING_STATUS_COUNTS['due-today']} due today`,
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
            delta: '▲ 2 vs last month',
            deltaTone: 'positive',
            accent: 'filed',
            sparklineData: [2, 3, 3, 4, 4, 5, filedCount],
            sparklineTone: 'filed',
            footnote: `${onTimeRate}% on time`,
          },
          {
            label: 'Total filings',
            value: String(totalFilings),
            unit: 'this period',
            delta: `${FILING_STATUS_COUNTS.upcoming} upcoming`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [18, 19, 20, 21, 22, 23, totalFilings],
            sparklineTone: 'authority',
            footnote: `${CLIENT_OPTIONS.length} clients`,
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
                  options={clientOptions}
                  value={clientFilter}
                  onChange={(v) => setClientFilter(v as string[])}
                />
                <FilterPopover
                  label="Law"
                  options={lawOptions}
                  value={lawFilter}
                  onChange={(v) => setLawFilter(v as string[])}
                />
                <FilterPopover
                  label="Handler"
                  options={handlerOptions}
                  value={handlerFilter}
                  onChange={(v) => setHandlerFilter(v as string[])}
                />
              </>
            }
            trailing={
              <>
                <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                  {filtered.length} of {totalFilings}
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
            <DataGridShell
              columns={FILING_COLUMNS}
              rows={filtered}
              getRowKey={(f) => f.id}
              onRowClick={(f) => setSelectedFiling(f)}
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
                        setSelectedFiling(filingRows.find((r) => r.id === row.id) ?? null)
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
                month={FILINGS_TODAY}
                onFilingClick={handleCalendarFilingClick}
              />
            </div>
          )}
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {selectedFiling && (
          <FilingDetailDrawer
            filing={selectedFiling}
            onClose={() => setSelectedFiling(null)}
          />
        )}
      </AnimatePresence>

      <BulkReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        filings={selectedFilings}
        handlers={MOCK_HANDLERS}
        onConfirm={applyReassign}
      />
    </>
  );
}
