import { useMemo, useState } from 'react';
import {
  Search,
  Command as CommandIcon,
  Plus,
  Moon,
  Sun,
  Upload,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import {
  MetricKPI,
  DataTable,
  Pagination,
  Button,
  FilterPopover,
  ColumnChooser,
  ActiveFilterChips,
  CoarseTabs,
  OrdinalDate,
  type DataTableColumn,
  type ActiveFilter,
} from '@packages/ui';
import {
  MOCK_CLIENT_ROWS,
  CLIENT_STATUS_COUNTS,
  CLIENT_RISK_COUNTS,
  type ClientRow,
  type ClientStatus,
  type ClientRiskLevel,
} from './clientsMock';

// ─── Constants ──────────────────────────────────────────────────────

type StatusTab = 'all' | ClientStatus;

const RISK_LABEL: Record<ClientRiskLevel, string> = {
  healthy: 'Healthy',
  'at-risk': 'At risk',
  critical: 'Critical',
};

const RISK_TONE: Record<ClientRiskLevel, string> = {
  healthy: 'bg-filed',
  'at-risk': 'bg-due-soon',
  critical: 'bg-signal',
};

const STATUS_TONE: Record<ClientStatus, string> = {
  active: 'bg-filed',
  onboarding: 'bg-due-soon',
  dormant: 'bg-ink-muted',
};

const HANDLER_OPTIONS = [
  { value: 'h1', label: 'Priya Shankar' },
  { value: 'h2', label: 'Arjun Mehta' },
  { value: 'h3', label: 'Kavita Rao' },
  { value: 'h4', label: 'Deepak Iyer' },
];

const RISK_OPTIONS: { value: ClientRiskLevel; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'at-risk', label: 'At risk' },
  { value: 'critical', label: 'Critical' },
];

// ─── Sub-components ─────────────────────────────────────────────────

function HealthBar({ pct }: { pct: number }) {
  const tone =
    pct >= 95 ? 'bg-filed' : pct >= 85 ? 'bg-authority' : pct >= 75 ? 'bg-due-soon' : 'bg-signal';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1 bg-rule">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-ink-soft w-7 text-right">
        {pct}%
      </span>
    </div>
  );
}

function RiskPill({ risk }: { risk: ClientRiskLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised`}
    >
      <span className={`w-1.5 h-1.5 flex-none ${RISK_TONE[risk]}`} aria-hidden />
      <span className="text-ink-soft">{RISK_LABEL[risk]}</span>
    </span>
  );
}

// ─── Table columns ──────────────────────────────────────────────────

const CLIENT_COLUMNS: DataTableColumn<ClientRow>[] = [
  {
    key: 'name',
    header: 'Client',
    cell: (c) => (
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="w-8 h-8 flex-none flex items-center justify-center text-[10px] font-sans font-semibold text-paper-raised"
          style={{ backgroundColor: c.color }}
        >
          {c.initials}
        </span>
        <div className="min-w-0">
          <span className="text-sm text-ink font-sans leading-snug truncate block">
            {c.name}
          </span>
          <span className="font-serif italic text-[11px] text-ink-muted truncate block">
            {c.legalName}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: 'taxIdentifier',
    header: 'Tax ID',
    width: '170px',
    cell: (c) => (
      <span className="font-mono text-[11px] tracking-tabular text-ink-soft">
        {c.taxIdentifier}
      </span>
    ),
  },
  {
    key: 'risk',
    header: 'Risk',
    width: '110px',
    cell: (c) => (c.status === 'active' ? <RiskPill risk={c.risk} /> : null),
  },
  {
    key: 'registeredLaws',
    header: 'Laws',
    width: '80px',
    align: 'right',
    cell: (c) => (
      <span className="font-mono text-sm tabular-nums text-ink">{c.registeredLaws}</span>
    ),
  },
  {
    key: 'openFilings',
    header: 'Open',
    width: '80px',
    align: 'right',
    cell: (c) => (
      <span className="font-mono text-sm tabular-nums text-ink">{c.openFilings || '—'}</span>
    ),
  },
  {
    key: 'overdueFilings',
    header: 'Overdue',
    width: '90px',
    align: 'right',
    cell: (c) => (
      <span
        className={`font-mono text-sm tabular-nums ${c.overdueFilings > 0 ? 'text-signal font-medium' : 'text-ink-muted'}`}
      >
        {c.overdueFilings || '—'}
      </span>
    ),
  },
  {
    key: 'onTimePct',
    header: 'On-time rate',
    width: '150px',
    cell: (c) => (c.onTimePct > 0 ? <HealthBar pct={c.onTimePct} /> : <span className="text-ink-muted text-[11px]">—</span>),
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '120px',
    cell: (c) => (
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden
          className="w-6 h-6 flex-none bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
        >
          {c.primaryHandler.initials}
        </span>
        <span className="text-[11px] font-sans text-ink-soft truncate">
          {c.primaryHandler.name.split(' ')[0]}
        </span>
      </div>
    ),
  },
  {
    key: 'lastFiling',
    header: 'Last filed',
    width: '110px',
    cell: (c) =>
      c.lastFilingDate ? (
        <OrdinalDate date={c.lastFilingDate} variant="short" className="text-[11px]" />
      ) : (
        <span className="text-ink-muted text-[11px]">—</span>
      ),
  },
];

const ALL_COLUMN_KEYS = CLIENT_COLUMNS.map((c) => c.key);
const REQUIRED_COLUMN_KEYS: string[] = ['name'];

// ─── Page ───────────────────────────────────────────────────────────

export function ClientsPage() {
  const [isDark, setIsDark] = useState(false);

  // Filter state.
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [riskFilter, setRiskFilter] = useState<ClientRiskLevel[]>([]);
  const [handlerFilter, setHandlerFilter] = useState<string[]>([]);

  // Column visibility.
  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_COLUMN_KEYS);

  // Pagination.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const toggleDark = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('dark', next);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    setPage(1);
    const q = search.trim().toLowerCase();
    return MOCK_CLIENT_ROWS.filter((c) => {
      if (statusTab !== 'all' && c.status !== statusTab) return false;
      if (riskFilter.length > 0 && !riskFilter.includes(c.risk)) return false;
      if (handlerFilter.length > 0 && !handlerFilter.includes(c.primaryHandler.id)) return false;
      if (q && !`${c.name} ${c.legalName} ${c.taxIdentifier}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [statusTab, riskFilter, handlerFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Active filter chips.
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const chips: ActiveFilter[] = [];
    for (const key of riskFilter) {
      chips.push({
        key: `risk:${key}`,
        group: 'Risk',
        value: RISK_LABEL[key],
        onRemove: () => setRiskFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    for (const key of handlerFilter) {
      const handler = HANDLER_OPTIONS.find((h) => h.value === key);
      chips.push({
        key: `handler:${key}`,
        group: 'Handler',
        value: handler?.label ?? key,
        onRemove: () => setHandlerFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    return chips;
  }, [riskFilter, handlerFilter]);

  const clearAll = () => {
    setRiskFilter([]);
    setHandlerFilter([]);
  };

  // KPI aggregates.
  const totalClients = MOCK_CLIENT_ROWS.length;
  const activeClients = CLIENT_STATUS_COUNTS.active;
  const totalOverdue = MOCK_CLIENT_ROWS.reduce((acc, c) => acc + c.overdueFilings, 0);
  const avgOnTime = Math.round(
    MOCK_CLIENT_ROWS.filter((c) => c.onTimePct > 0).reduce((acc, c) => acc + c.onTimePct, 0) /
      MOCK_CLIENT_ROWS.filter((c) => c.onTimePct > 0).length,
  );

  // Filter popover options.
  const riskOptions = RISK_OPTIONS.map((r) => ({
    value: r.value,
    label: r.label,
    count: MOCK_CLIENT_ROWS.filter((c) => c.risk === r.value && c.status === 'active').length,
  }));

  const handlerOptions = HANDLER_OPTIONS.map((h) => ({
    value: h.value,
    label: h.label,
    count: MOCK_CLIENT_ROWS.filter((c) => c.primaryHandler.id === h.value).length,
  }));

  const columnChooserItems = CLIENT_COLUMNS.map((c) => ({
    key: c.key,
    label: c.header,
    required: REQUIRED_COLUMN_KEYS.includes(c.key),
  }));

  // Coarse tabs.
  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalClients },
    { value: 'active' as const, label: 'Active', count: CLIENT_STATUS_COUNTS.active },
    {
      value: 'onboarding' as const,
      label: 'Onboarding',
      count: CLIENT_STATUS_COUNTS.onboarding,
    },
    { value: 'dormant' as const, label: 'Dormant', count: CLIENT_STATUS_COUNTS.dormant },
  ];

  return (
    <div className="min-h-screen bg-paper paper-grain">
      {/* ─── Top chrome ─────────────────────────────────────────────────── */}
      <div className="border-b border-rule bg-paper-raised">
        <div className="max-w-[1480px] mx-auto px-10 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-serif text-2xl italic text-ink leading-none">
              Compliance<span className="text-signal">.</span>
            </span>
            <nav className="flex items-center gap-6 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-soft">
              <a className="hover:text-ink">Dashboard</a>
              <a className="text-ink border-b border-ink pb-0.5">Clients</a>
              <a className="hover:text-ink">Laws</a>
              <a className="hover:text-ink">Filings</a>
              <a className="hover:text-ink">Reports</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 border border-rule hover:border-ink text-[11px] text-ink-muted hover:text-ink font-sans transition-colors"
            >
              <Search className="w-3 h-3" strokeWidth={1.5} />
              <span>Search or command</span>
              <span className="ml-4 flex items-center gap-0.5 font-mono text-[10px] text-ink-muted/80">
                <CommandIcon className="w-3 h-3" strokeWidth={1.5} />K
              </span>
            </button>
            <button
              type="button"
              onClick={toggleDark}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center justify-center w-8 h-8 border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
            <div className="flex items-center gap-2 pl-4 border-l border-rule">
              <span
                aria-hidden
                className="w-7 h-7 bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
              >
                DI
              </span>
              <div className="text-right">
                <div className="text-xs text-ink font-sans leading-none">Deepak Iyer</div>
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans mt-0.5">
                  Partner
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        {/* ─── Page header ──────────────────────────────────────────────── */}
        <header className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
              <span>Portfolio</span>
              <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              <span className="text-ink">Clients</span>
            </div>
            <h1 className="font-serif text-4xl text-ink leading-none mt-1">Clients</h1>
            <p className="mt-2 font-serif italic text-ink-soft max-w-2xl">
              {totalClients} entities under management — {activeClients} active,{' '}
              {CLIENT_STATUS_COUNTS.onboarding} onboarding, {CLIENT_STATUS_COUNTS.dormant} dormant.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Import
            </Button>
            <Button size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Add client
            </Button>
          </div>
        </header>

        {/* ─── Alert strip ──────────────────────────────────────────────── */}
        {totalOverdue > 0 && (
          <div className="mb-6 border border-signal/40 bg-signal/5 px-5 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-signal flex-shrink-0" strokeWidth={2} />
            <p className="flex-1 text-sm text-ink">
              <span className="font-sans font-medium">
                {CLIENT_RISK_COUNTS.critical} client{CLIENT_RISK_COUNTS.critical !== 1 ? 's' : ''} in
                critical status
              </span>{' '}
              <span className="text-ink-soft">
                with {totalOverdue} overdue filings across the portfolio.
              </span>
            </p>
            <button
              type="button"
              className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-signal hover:underline"
            >
              Review →
            </button>
          </div>
        )}

        {/* ─── KPI row ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule">
          <MetricKPI
            label="Total clients"
            value={String(totalClients)}
            unit="entities"
            delta="▲ 1 this month"
            deltaTone="positive"
            accent="authority"
            sparklineData={[8, 9, 9, 10, 10, 11, totalClients]}
            sparklineTone="authority"
            footnote={`${activeClients} active`}
            index={0}
          />
          <MetricKPI
            label="Registrations"
            value={String(MOCK_CLIENT_ROWS.reduce((acc, c) => acc + c.registeredLaws, 0))}
            unit="law links"
            delta={`across ${activeClients} clients`}
            deltaTone="neutral"
            accent="filed"
            sparklineData={[32, 35, 37, 40, 42, 44, MOCK_CLIENT_ROWS.reduce((a, c) => a + c.registeredLaws, 0)]}
            sparklineTone="filed"
            footnote="avg 3.8 per client"
            index={1}
          />
          <MetricKPI
            label="Overdue filings"
            value={String(totalOverdue)}
            unit="filings"
            delta={`across ${MOCK_CLIENT_ROWS.filter((c) => c.overdueFilings > 0).length} clients`}
            deltaTone="negative"
            accent="signal"
            sparklineData={[5, 7, 8, 9, 10, 11, totalOverdue]}
            sparklineTone="signal"
            footnote={`${CLIENT_RISK_COUNTS.critical} critical`}
            index={2}
          />
          <MetricKPI
            label="Avg. on-time rate"
            value={String(avgOnTime)}
            unit="%"
            delta="▲ 1.2 vs Q4"
            deltaTone="positive"
            accent="filed"
            sparklineData={[84, 85, 86, 87, 88, 89, avgOnTime]}
            sparklineTone="filed"
            footnote="trailing 12 months"
            index={3}
          />
        </section>

        {/* ─── Table section ────────────────────────────────────────────── */}
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
                placeholder="Search clients…"
                className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans"
              />
            </label>

            <div className="flex items-center gap-2">
              <FilterPopover
                label="Risk"
                options={riskOptions}
                value={riskFilter}
                onChange={(v) => setRiskFilter(v as ClientRiskLevel[])}
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
                {filtered.length} of {totalClients}
              </span>
              <ColumnChooser
                columns={columnChooserItems}
                visible={visibleColumns}
                onChange={setVisibleColumns}
              />
            </div>
          </div>

          <ActiveFilterChips filters={activeFilters} onClearAll={clearAll} />

          <div className="mt-4 bg-paper-raised border border-rule overflow-x-auto">
            <DataTable
              columns={CLIENT_COLUMNS}
              visibleColumns={visibleColumns}
              rows={paginatedRows}
              getRowKey={(c) => c.id}
              onRowClick={() => {}}
            />
            <Pagination
              page={page}
              pageSize={pageSize}
              pageCount={pageCount}
              totalRows={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
