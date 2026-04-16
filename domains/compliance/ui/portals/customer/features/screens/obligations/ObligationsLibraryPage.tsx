import { useMemo, useState } from 'react';
import {
  Search,
  Command as CommandIcon,
  Plus,
  Moon,
  Sun,
  Upload,
  ChevronRight,
} from 'lucide-react';
import {
  MetricKPI,
  DataTable,
  Pagination,
  JurisdictionTag,
  Button,
  FilterPopover,
  ColumnChooser,
  ActiveFilterChips,
  CoarseTabs,
  type DataTableColumn,
  type ActiveFilter,
} from '@packages/ui';
import {
  LAW_GROUPS,
  MOCK_OBLIGATIONS,
  OBLIGATION_STATUS_COUNTS,
  type LawGroupKey,
  type Obligation,
  type ObligationFrequency,
} from './obligationsMock';

const FREQUENCY_LABEL: Record<ObligationFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Half-yearly',
  yearly: 'Yearly',
  event: 'On event',
  'ad-hoc': 'Ad-hoc',
};

type StatusTab = 'all' | Obligation['status'];
type JurisdictionKey = 'central' | 'state' | 'municipal';

const JURISDICTION_OPTIONS: { value: JurisdictionKey; label: string }[] = [
  { value: 'central', label: 'Central' },
  { value: 'state', label: 'State' },
  { value: 'municipal', label: 'Municipal' },
];

const FREQUENCY_OPTIONS: { value: ObligationFrequency; label: string }[] = (
  Object.keys(FREQUENCY_LABEL) as ObligationFrequency[]
).map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }));

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

function FrequencyPill({ frequency }: { frequency: ObligationFrequency }) {
  return (
    <span className="inline-flex items-center px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] text-ink-soft bg-paper-raised">
      {FREQUENCY_LABEL[frequency]}
    </span>
  );
}

const STATUS_TONE: Record<Obligation['status'], string> = {
  active: 'bg-filed',
  draft: 'bg-due-soon',
  deprecated: 'bg-ink-muted',
};

const OBLIGATION_COLUMNS: DataTableColumn<Obligation>[] = [
  {
    key: 'code',
    header: 'Code',
    width: '110px',
    cell: (o) => (
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          title={o.status}
          className={`w-1.5 h-1.5 flex-none ${STATUS_TONE[o.status]}`}
        />
        <span className="font-mono text-[11px] tracking-tabular uppercase text-ink">
          {o.code}
        </span>
      </div>
    ),
  },
  {
    key: 'name',
    header: 'Obligation',
    cell: (o) => (
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-ink font-sans leading-snug truncate">{o.name}</span>
        <span className="font-serif italic text-[11px] text-ink-muted truncate">
          {o.description}
        </span>
      </div>
    ),
  },
  {
    key: 'law',
    header: 'Law',
    width: '130px',
    cell: (o) => (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-muted tracking-tabular uppercase">
          {o.lawCode}
        </span>
        <JurisdictionTag jurisdiction={o.jurisdiction} />
      </div>
    ),
  },
  {
    key: 'frequency',
    header: 'Cadence',
    width: '100px',
    cell: (o) => <FrequencyPill frequency={o.frequency} />,
  },
  {
    key: 'applicable',
    header: 'Applies to',
    width: '110px',
    align: 'right',
    cell: (o) => (
      <div className="flex items-baseline justify-end gap-1.5">
        <span className="font-mono text-sm tabular-nums text-ink">{o.applicableClients}</span>
        <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
          clients
        </span>
      </div>
    ),
  },
  {
    key: 'health',
    header: 'On-time rate',
    width: '150px',
    cell: (o) => <HealthBar pct={o.onTimePct} />,
  },
  {
    key: 'owner',
    header: 'Owner',
    width: '110px',
    cell: (o) => (
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden
          className="w-6 h-6 flex-none bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
        >
          {o.owner.initials}
        </span>
        <span className="text-[11px] font-sans text-ink-soft truncate">
          {o.owner.name.split(' ')[0]}
        </span>
      </div>
    ),
  },
];

const ALL_COLUMN_KEYS = OBLIGATION_COLUMNS.map((c) => c.key);
const REQUIRED_COLUMN_KEYS: string[] = ['code', 'name'];

export function ObligationsLibraryPage() {
  const [isDark, setIsDark] = useState(false);

  // Filter state — popover multi-selects return arrays.
  const [lawFilter, setLawFilter] = useState<LawGroupKey[]>([]);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<JurisdictionKey[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<ObligationFrequency[]>([]);
  const [search, setSearch] = useState('');

  // Coarse tab takes the place of the sidebar "Status" section.
  const [statusTab, setStatusTab] = useState<StatusTab>('all');

  // Column visibility driven by ColumnChooser.
  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_COLUMN_KEYS);

  // Pagination state.
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
    // Reset to page 1 whenever filters change.
    setPage(1);
    const q = search.trim().toLowerCase();
    return MOCK_OBLIGATIONS.filter((o) => {
      if (statusTab !== 'all' && o.status !== statusTab) return false;
      if (lawFilter.length > 0 && !lawFilter.includes(o.lawGroup)) return false;
      if (
        jurisdictionFilter.length > 0 &&
        !jurisdictionFilter.includes(o.jurisdiction as JurisdictionKey)
      )
        return false;
      if (frequencyFilter.length > 0 && !frequencyFilter.includes(o.frequency)) return false;
      if (q && !`${o.code} ${o.name} ${o.lawName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [statusTab, lawFilter, jurisdictionFilter, frequencyFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Derive active filter chips from filter state.
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const chips: ActiveFilter[] = [];
    for (const key of lawFilter) {
      const group = LAW_GROUPS.find((g) => g.key === key);
      chips.push({
        key: `law:${key}`,
        group: 'Law',
        value: group?.label ?? key,
        onRemove: () => setLawFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    for (const key of jurisdictionFilter) {
      chips.push({
        key: `jurisdiction:${key}`,
        group: 'Jurisdiction',
        value: JURISDICTION_OPTIONS.find((j) => j.value === key)?.label ?? key,
        onRemove: () => setJurisdictionFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    for (const key of frequencyFilter) {
      chips.push({
        key: `frequency:${key}`,
        group: 'Cadence',
        value: FREQUENCY_LABEL[key],
        onRemove: () => setFrequencyFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    return chips;
  }, [lawFilter, jurisdictionFilter, frequencyFilter]);

  const clearAll = () => {
    setLawFilter([]);
    setJurisdictionFilter([]);
    setFrequencyFilter([]);
  };

  const totalCoverage = Math.round(
    MOCK_OBLIGATIONS.reduce((acc, o) => acc + o.onTimePct, 0) / MOCK_OBLIGATIONS.length,
  );
  const totalFilingsThisPeriod = MOCK_OBLIGATIONS.reduce((acc, o) => acc + o.filingsThisPeriod, 0);

  // Popover option lists.
  const lawOptions = LAW_GROUPS.map((g) => ({
    value: g.key,
    label: g.label,
    count: g.count,
  }));

  const jurisdictionOptions = JURISDICTION_OPTIONS.map((j) => ({
    value: j.value,
    label: j.label,
    count: MOCK_OBLIGATIONS.filter((o) => o.jurisdiction === j.value).length,
  }));

  const frequencyOptions = FREQUENCY_OPTIONS.map((f) => ({
    value: f.value,
    label: f.label,
    count: MOCK_OBLIGATIONS.filter((o) => o.frequency === f.value).length,
  }));

  const columnChooserItems = OBLIGATION_COLUMNS.map((c) => ({
    key: c.key,
    label: c.header,
    required: REQUIRED_COLUMN_KEYS.includes(c.key),
  }));

  // Coarse tab counts.
  const statusTabs = [
    { value: 'all' as const, label: 'All', count: MOCK_OBLIGATIONS.length },
    { value: 'active' as const, label: 'Active', count: OBLIGATION_STATUS_COUNTS.active },
    { value: 'draft' as const, label: 'Draft', count: OBLIGATION_STATUS_COUNTS.draft },
    {
      value: 'deprecated' as const,
      label: 'Deprecated',
      count: OBLIGATION_STATUS_COUNTS.deprecated,
    },
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
              <a className="hover:text-ink">Clients</a>
              <a className="text-ink border-b border-ink pb-0.5">Laws</a>
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
              <span>Knowledge base</span>
              <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              <span>Laws</span>
              <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              <span className="text-ink">Obligations Library</span>
            </div>
            <h1 className="font-serif text-4xl text-ink leading-none mt-1">Obligations Library</h1>
            <p className="mt-2 font-serif italic text-ink-soft max-w-2xl">
              {MOCK_OBLIGATIONS.length} rules across {LAW_GROUPS.length} law groups — the canonical
              catalog used to generate filings for every client on roll-over.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Import
            </Button>
            <Button size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              New obligation
            </Button>
          </div>
        </header>

        {/* ─── KPI row ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule">
          <MetricKPI
            label="Total obligations"
            value={String(MOCK_OBLIGATIONS.length)}
            unit="rules"
            delta={`${LAW_GROUPS.length} law groups`}
            deltaTone="neutral"
            accent="authority"
            sparklineData={[72, 75, 78, 82, 83, 85, MOCK_OBLIGATIONS.length]}
            sparklineTone="authority"
            footnote="catalog size"
            index={0}
          />
          <MetricKPI
            label="Active"
            value={String(OBLIGATION_STATUS_COUNTS.active)}
            unit="rules"
            delta="▲ 2 since last review"
            deltaTone="positive"
            accent="filed"
            sparklineData={[68, 70, 71, 72, 73, 74, OBLIGATION_STATUS_COUNTS.active]}
            sparklineTone="filed"
            footnote={`of ${MOCK_OBLIGATIONS.length} total`}
            index={1}
          />
          <MetricKPI
            label="In draft"
            value={String(OBLIGATION_STATUS_COUNTS.draft)}
            unit="rules"
            delta="awaiting review"
            deltaTone="neutral"
            accent="due-soon"
            sparklineData={[4, 6, 7, 8, 6, 5, OBLIGATION_STATUS_COUNTS.draft]}
            sparklineTone="due-soon"
            footnote="open for edits"
            index={2}
          />
          <MetricKPI
            label="Avg. on-time rate"
            value={`${totalCoverage}`}
            unit="%"
            delta="▲ 2.1 vs Q4"
            deltaTone="positive"
            accent="filed"
            sparklineData={[84, 86, 87, 88, 89, 90, totalCoverage]}
            sparklineTone="filed"
            footnote={`${totalFilingsThisPeriod} filings this period`}
            index={3}
          />
        </section>

        {/* ─── Full-width table block ───────────────────────────────────── */}
        <section className="mt-10">
          {/* Coarse tabs — status cut */}
          <CoarseTabs variant="segmented" tabs={statusTabs} value={statusTab} onChange={setStatusTab} />

          {/* Filter bar — search + popover filter buttons + column chooser */}
          <div className="flex items-center gap-3 py-3 border-b border-rule">
            <label className="flex items-center gap-2 min-w-[200px] max-w-xs flex-1 border-b border-rule focus-within:border-ink transition-colors pb-1">
              <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search obligations…"
                className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans"
              />
            </label>

            <div className="flex items-center gap-2">
              <FilterPopover
                label="Law group"
                options={lawOptions}
                value={lawFilter}
                onChange={(v) => setLawFilter(v as LawGroupKey[])}
              />
              <FilterPopover
                label="Jurisdiction"
                options={jurisdictionOptions}
                value={jurisdictionFilter}
                onChange={(v) => setJurisdictionFilter(v as JurisdictionKey[])}
              />
              <FilterPopover
                label="Cadence"
                options={frequencyOptions}
                value={frequencyFilter}
                onChange={(v) => setFrequencyFilter(v as ObligationFrequency[])}
              />
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                {filtered.length} of {MOCK_OBLIGATIONS.length}
              </span>
              <ColumnChooser
                columns={columnChooserItems}
                visible={visibleColumns}
                onChange={setVisibleColumns}
              />
            </div>
          </div>

          {/* Active filter chips — always visible summary of what's applied */}
          <ActiveFilterChips filters={activeFilters} onClearAll={clearAll} />

          <div className="mt-4 bg-paper-raised border border-rule overflow-x-auto">
            <DataTable
              columns={OBLIGATION_COLUMNS}
              visibleColumns={visibleColumns}
              rows={paginatedRows}
              getRowKey={(o) => o.id}
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
