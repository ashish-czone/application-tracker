import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronRight,
  AlertTriangle,
  List,
  Columns3,
  CalendarDays,
  Download,
} from 'lucide-react';
import {
  MetricKPI,
  DataGridShell,
  Button,
  FilterPopover,
  ColumnChooser,
  ActiveFilterChips,
  CoarseTabs,
  OrdinalDate,
  UrgencyBadge,
  JurisdictionTag,
  KanbanBoard,
  type DataTableColumn,
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
} from './filingsMock';
import { FilingDetailDrawer } from './FilingDetailDrawer';
import type { Filing } from '../../../../../shared/types';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

// ─── Constants ──────────────────────────────────────────────────────

type StatusTab = 'all' | Filing['status'];
type ViewMode = 'list' | 'kanban' | 'calendar';

const STATUS_LABEL: Record<Filing['status'], string> = {
  overdue: 'Overdue',
  'due-today': 'Due today',
  'due-this-week': 'Due this week',
  upcoming: 'Upcoming',
  filed: 'Filed',
  draft: 'Draft',
};

const PRIORITY_TONE: Record<string, string> = {
  critical: 'text-signal',
  high: 'text-due-soon',
  normal: 'text-ink-muted',
  low: 'text-ink-muted/60',
};

// ─── Table columns ──────────────────────────────────────────────────

const FILING_COLUMNS: DataTableColumn<FilingRow>[] = [
  {
    key: 'filing',
    header: 'Filing',
    cell: (f) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-tabular uppercase text-ink font-medium">
            {f.lawCode}
          </span>
          <JurisdictionTag jurisdiction={f.jurisdiction} />
        </div>
        <span className="text-sm text-ink font-sans leading-snug truncate block mt-0.5">
          {f.ruleName}
        </span>
      </div>
    ),
  },
  {
    key: 'client',
    header: 'Client',
    width: '140px',
    cell: (f) => (
      <span className="text-sm text-ink font-sans truncate block">{f.clientName}</span>
    ),
  },
  {
    key: 'period',
    header: 'Period',
    width: '100px',
    cell: (f) => (
      <span className="font-mono text-[11px] tabular-nums text-ink-soft">{f.periodLabel}</span>
    ),
  },
  {
    key: 'dueDate',
    header: 'Due',
    width: '110px',
    cell: (f) => <OrdinalDate date={f.dueDate} variant="short" className="text-[11px]" />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '120px',
    cell: (f) => <UrgencyBadge urgency={f.status} />,
  },
  {
    key: 'priority',
    header: 'Priority',
    width: '90px',
    cell: (f) => (
      <span className={`text-[11px] uppercase tracking-eyebrow font-sans font-medium ${PRIORITY_TONE[f.priority]}`}>
        {f.priority}
      </span>
    ),
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '120px',
    cell: (f) =>
      f.handler ? (
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="w-6 h-6 flex-none bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
          >
            {f.handler.initials}
          </span>
          <span className="text-[11px] font-sans text-ink-soft truncate">
            {f.handler.name.split(' ')[0]}
          </span>
        </div>
      ) : null,
  },
];

const ALL_COLUMN_KEYS = FILING_COLUMNS.map((c) => c.key);
const REQUIRED_COLUMN_KEYS: string[] = ['filing'];

// ─── Kanban columns ─────────────────────────────────────────────────

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: 'overdue', label: 'Overdue', color: 'hsl(var(--signal))' },
  { id: 'due-today', label: 'Due Today', color: 'hsl(var(--due-soon))' },
  { id: 'due-this-week', label: 'This Week', color: 'hsl(var(--authority))' },
  { id: 'upcoming', label: 'Upcoming', color: 'hsl(var(--ink-muted))' },
  { id: 'filed', label: 'Filed', color: 'hsl(var(--filed))' },
];

// ─── Page ───────────────────────────────────────────────────────────

export function FilingsPage() {
  // View mode.
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Filter state.
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [lawFilter, setLawFilter] = useState<string[]>([]);
  const [handlerFilter, setHandlerFilter] = useState<string[]>([]);

  // Column visibility.
  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_COLUMN_KEYS);

  // Detail drawer.
  const [selectedFiling, setSelectedFiling] = useState<FilingRow | null>(null);


  // ── Filtering ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_FILING_ROWS.filter((f) => {
      if (statusTab !== 'all' && f.status !== statusTab) return false;
      if (clientFilter.length > 0 && !clientFilter.includes(f.clientId)) return false;
      if (lawFilter.length > 0 && !lawFilter.includes(f.lawId)) return false;
      if (handlerFilter.length > 0 && (!f.handler || !handlerFilter.includes(f.handler.id)))
        return false;
      if (q && !`${f.lawCode} ${f.ruleName} ${f.clientName} ${f.periodLabel}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [statusTab, clientFilter, lawFilter, handlerFilter, search]);

  // ── Active filter chips ─────────────────────────────────────────

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

  // ── KPI aggregates ──────────────────────────────────────────────

  const totalFilings = MOCK_FILING_ROWS.length;
  const overdueCount = FILING_STATUS_COUNTS.overdue;
  const dueThisWeekCount =
    FILING_STATUS_COUNTS['due-today'] + FILING_STATUS_COUNTS['due-this-week'];
  const filedCount = FILING_STATUS_COUNTS.filed;
  const onTimeRate = Math.round(
    (MOCK_FILING_ROWS.filter((f) => f.status === 'filed').length / totalFilings) * 100,
  );

  // ── Filter popover options ──────────────────────────────────────

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
    required: REQUIRED_COLUMN_KEYS.includes(c.key),
  }));

  // ── Coarse tabs ─────────────────────────────────────────────────

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

  // ── Kanban data ─────────────────────────────────────────────────

  const kanbanCards: KanbanCardData[] = useMemo(
    () =>
      filtered.map((f) => ({
        ...f,
        id: f.id,
        columnId: f.status,
      })),
    [filtered],
  );

  function handleCardMove(event: { cardId: string; toColumnId: string }) {
    // Static preview — no real state mutation. In a wired version this
    // would call onStatusChange and update the filing's status.
    const filing = MOCK_FILING_ROWS.find((f) => f.id === event.cardId);
    if (filing) {
      setSelectedFiling({ ...filing, status: event.toColumnId as Filing['status'] });
    }
  }

  // ── Calendar day click ──────────────────────────────────────────

  function handleDayClick(_date: Date, dayFilings: Filing[]) {
    if (dayFilings.length > 0) {
      const row = MOCK_FILING_ROWS.find((f) => f.id === dayFilings[0].id);
      if (row) setSelectedFiling(row);
    }
  }

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="filings" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        {/* ─── Page header ──────────────────────────────────────────────── */}
        <header className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
              <span>Workspace</span>
              <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              <span className="text-ink">Filings</span>
            </div>
            <h1 className="font-serif text-4xl text-ink leading-none mt-1">Filings</h1>
            <p className="mt-2 font-serif italic text-ink-soft max-w-2xl">
              {totalFilings} filings across {CLIENT_OPTIONS.length} clients — {overdueCount}{' '}
              overdue, {dueThisWeekCount} due this week.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex border border-rule">
              {VIEW_MODES.map((vm) => (
                <button
                  key={vm.key}
                  type="button"
                  onClick={() => setViewMode(vm.key)}
                  className={`flex items-center justify-center w-8 h-8 transition-colors ${
                    viewMode === vm.key
                      ? 'bg-ink text-paper'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                  aria-label={vm.label}
                >
                  <vm.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ─── Alert strip ──────────────────────────────────────────────── */}
        {overdueCount > 0 && (
          <div className="mb-6 border border-signal/40 bg-signal/5 px-5 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-signal flex-shrink-0" strokeWidth={2} />
            <p className="flex-1 text-sm text-ink">
              <span className="font-sans font-medium">
                {overdueCount} filing{overdueCount !== 1 ? 's' : ''} overdue
              </span>{' '}
              <span className="text-ink-soft">
                across{' '}
                {new Set(MOCK_FILING_ROWS.filter((f) => f.status === 'overdue').map((f) => f.clientId)).size}{' '}
                clients. Immediate action required.
              </span>
            </p>
            <button
              type="button"
              onClick={() => setStatusTab('overdue')}
              className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-signal hover:underline"
            >
              Show overdue →
            </button>
          </div>
        )}

        {/* ─── KPI row ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule">
          <MetricKPI
            label="Overdue"
            value={String(overdueCount)}
            unit="filings"
            delta={`${MOCK_FILING_ROWS.filter((f) => f.status === 'overdue' && f.priority === 'critical').length} critical`}
            deltaTone="negative"
            accent="signal"
            sparklineData={[2, 3, 3, 4, 3, 4, overdueCount]}
            sparklineTone="signal"
            footnote="need action now"
            index={0}
          />
          <MetricKPI
            label="Due this week"
            value={String(dueThisWeekCount)}
            unit="filings"
            delta={`${FILING_STATUS_COUNTS['due-today']} due today`}
            deltaTone="neutral"
            accent="due-soon"
            sparklineData={[5, 6, 7, 6, 7, 8, dueThisWeekCount]}
            sparklineTone="due-soon"
            footnote="across all clients"
            index={1}
          />
          <MetricKPI
            label="Filed this month"
            value={String(filedCount)}
            unit="completed"
            delta="▲ 2 vs last month"
            deltaTone="positive"
            accent="filed"
            sparklineData={[2, 3, 3, 4, 4, 5, filedCount]}
            sparklineTone="filed"
            footnote={`${onTimeRate}% on time`}
            index={2}
          />
          <MetricKPI
            label="Total filings"
            value={String(totalFilings)}
            unit="this period"
            delta={`${FILING_STATUS_COUNTS.upcoming} upcoming`}
            deltaTone="neutral"
            accent="authority"
            sparklineData={[18, 19, 20, 21, 22, 23, totalFilings]}
            sparklineTone="authority"
            footnote={`${CLIENT_OPTIONS.length} clients`}
            index={3}
          />
        </section>

        {/* ─── Table / Kanban / Calendar section ───────────────────────── */}
        <section className="mt-10">
          <CoarseTabs
            variant="segmented"
            tabs={statusTabs}
            value={statusTab}
            onChange={setStatusTab}
          />

          {/* Filter bar */}
          <div className="flex items-center gap-3 py-3 border-b border-rule">
            <label className="flex items-center gap-2 min-w-[200px] max-w-xs flex-1 border-b border-rule focus-within:border-ink transition-colors pb-1">
              <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search filings…"
                className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans"
              />
            </label>

            <div className="flex items-center gap-2">
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
            </div>

            <div className="ml-auto flex items-center gap-3">
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
            </div>
          </div>

          <ActiveFilterChips filters={activeFilters} onClearAll={clearAll} />

          {/* ── List view ──────────────────────────────────────────── */}
          {viewMode === 'list' && (
            <DataGridShell
              columns={FILING_COLUMNS}
              rows={filtered}
              getRowKey={(f) => f.id}
              onRowClick={(f) => setSelectedFiling(f)}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={setVisibleColumns}
              hideToolbar
            />
          )}

          {/* ── Kanban view ────────────────────────────────────────── */}
          {viewMode === 'kanban' && (
            <div className="mt-4">
              <KanbanBoard
                columns={KANBAN_COLUMNS}
                cards={kanbanCards}
                onCardMove={handleCardMove}
                renderCard={(card) => {
                  const f = card as unknown as FilingRow;
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedFiling(MOCK_FILING_ROWS.find((r) => r.id === f.id) ?? null)}
                      className="w-full text-left bg-paper-raised border border-rule p-3 hover:bg-paper-sunken/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] tracking-tabular uppercase text-ink font-medium">
                          {f.lawCode}
                        </span>
                        <JurisdictionTag jurisdiction={f.jurisdiction} />
                      </div>
                      <div className="text-sm text-ink font-sans leading-snug truncate">
                        {f.ruleName}
                      </div>
                      <div className="text-[11px] text-ink-muted font-sans mt-0.5 truncate">
                        {f.clientName}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-rule/50">
                        <OrdinalDate date={f.dueDate} variant="short" className="text-[10px]" />
                        {f.handler && (
                          <span
                            aria-hidden
                            className="w-5 h-5 bg-authority text-paper-raised text-[9px] font-sans font-semibold flex items-center justify-center flex-none"
                          >
                            {f.handler.initials}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                }}
              />
            </div>
          )}

          {/* ── Calendar view ──────────────────────────────────────── */}
          {viewMode === 'calendar' && (
            <div className="mt-4">
              <ComplianceCalendar
                filings={filtered}
                month={FILINGS_TODAY}
                onDayClick={handleDayClick}
              />
            </div>
          )}
        </section>
      </main>

      {/* ─── Detail drawer ────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedFiling && (
          <FilingDetailDrawer
            filing={selectedFiling}
            onClose={() => setSelectedFiling(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── View mode definitions ──────────────────────────────────────────

const VIEW_MODES: { key: ViewMode; label: string; icon: typeof List }[] = [
  { key: 'list', label: 'List view', icon: List },
  { key: 'kanban', label: 'Board view', icon: Columns3 },
  { key: 'calendar', label: 'Calendar view', icon: CalendarDays },
];
