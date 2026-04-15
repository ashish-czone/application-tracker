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
  JurisdictionTag,
  Button,
  type DataTableColumn,
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

type LawFilter = LawGroupKey | 'all';
type JurisdictionFilter = 'all' | 'central' | 'state';

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

function StatusDot({ status }: { status: Obligation['status'] }) {
  const map = {
    active: { tone: 'bg-filed', label: 'Active' },
    draft: { tone: 'bg-due-soon', label: 'Draft' },
    deprecated: { tone: 'bg-ink-muted', label: 'Deprecated' },
  } as const;
  const { tone, label } = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-sans uppercase tracking-eyebrow text-ink-soft">
      <span className={`w-1.5 h-1.5 ${tone}`} aria-hidden />
      {label}
    </span>
  );
}

const OBLIGATION_COLUMNS: DataTableColumn<Obligation>[] = [
  {
    key: 'code',
    header: 'Code',
    width: '120px',
    cell: (o) => (
      <span className="font-mono text-[11px] tracking-tabular uppercase text-ink">{o.code}</span>
    ),
  },
  {
    key: 'name',
    header: 'Obligation',
    cell: (o) => (
      <div className="flex flex-col max-w-[340px]">
        <span className="text-sm text-ink font-sans leading-snug">{o.name}</span>
        <span className="font-serif italic text-[11px] text-ink-muted truncate">
          {o.description}
        </span>
      </div>
    ),
  },
  {
    key: 'law',
    header: 'Law',
    width: '160px',
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
    width: '120px',
    cell: (o) => <FrequencyPill frequency={o.frequency} />,
  },
  {
    key: 'applicable',
    header: 'Applies to',
    width: '100px',
    cell: (o) => (
      <div className="flex flex-col items-end">
        <span className="font-mono text-sm tabular-nums text-ink">{o.applicableClients}</span>
        <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
          clients
        </span>
      </div>
    ),
  },
  {
    key: 'period',
    header: 'This period',
    width: '100px',
    cell: (o) => (
      <span className="font-mono text-sm tabular-nums text-ink-soft">
        {o.filingsThisPeriod > 0 ? o.filingsThisPeriod : '—'}
      </span>
    ),
  },
  {
    key: 'health',
    header: 'On-time rate',
    width: '180px',
    cell: (o) => <HealthBar pct={o.onTimePct} />,
  },
  {
    key: 'owner',
    header: 'Owner',
    width: '140px',
    cell: (o) => (
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="w-6 h-6 bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
        >
          {o.owner.initials}
        </span>
        <span className="text-[11px] font-sans text-ink-soft truncate max-w-[90px]">
          {o.owner.name.split(' ')[0]}
        </span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '110px',
    cell: (o) => <StatusDot status={o.status} />,
  },
];

export function ObligationsLibraryPage() {
  const [isDark, setIsDark] = useState(false);
  const [lawFilter, setLawFilter] = useState<LawFilter>('all');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<JurisdictionFilter>('all');
  const [search, setSearch] = useState('');

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
    const q = search.trim().toLowerCase();
    return MOCK_OBLIGATIONS.filter((o) => {
      if (lawFilter !== 'all' && o.lawGroup !== lawFilter) return false;
      if (jurisdictionFilter !== 'all' && o.jurisdiction !== jurisdictionFilter) return false;
      if (q && !`${o.code} ${o.name} ${o.lawName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lawFilter, jurisdictionFilter, search]);

  const totalCoverage = Math.round(
    MOCK_OBLIGATIONS.reduce((acc, o) => acc + o.onTimePct, 0) / MOCK_OBLIGATIONS.length,
  );
  const totalFilingsThisPeriod = MOCK_OBLIGATIONS.reduce((acc, o) => acc + o.filingsThisPeriod, 0);

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

        {/* ─── Content grid: sidebar + table ─────────────────────────────── */}
        <section className="mt-8 grid grid-cols-12 gap-6">
          {/* Browse sidebar */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="bg-paper-raised border border-rule">
              {/* Search */}
              <div className="p-4 border-b border-rule">
                <label className="flex items-center gap-2 border-b border-rule focus-within:border-ink transition-colors pb-1">
                  <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search obligations…"
                    className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans"
                  />
                </label>
              </div>

              {/* Law groups */}
              <div className="px-4 py-4 border-b border-rule">
                <p className="text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
                  Law group
                </p>
                <ul className="space-y-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => setLawFilter('all')}
                      className={`w-full flex items-center justify-between text-left py-1 ${
                        lawFilter === 'all' ? 'text-ink' : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      <span
                        className={`text-sm font-sans ${
                          lawFilter === 'all' ? 'font-medium' : ''
                        }`}
                      >
                        All obligations
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                        {MOCK_OBLIGATIONS.length}
                      </span>
                    </button>
                  </li>
                  {LAW_GROUPS.map((g) => {
                    const active = lawFilter === g.key;
                    return (
                      <li key={g.key}>
                        <button
                          type="button"
                          onClick={() => setLawFilter(g.key)}
                          className={`w-full flex items-center justify-between text-left py-1 ${
                            active ? 'text-ink' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          <span
                            className={`text-sm font-sans truncate ${
                              active ? 'font-medium' : ''
                            }`}
                          >
                            {g.label}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                            {g.count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Jurisdiction */}
              <div className="px-4 py-4 border-b border-rule">
                <p className="text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
                  Jurisdiction
                </p>
                <ul className="space-y-1">
                  {(
                    [
                      { key: 'all', label: 'All', count: MOCK_OBLIGATIONS.length },
                      {
                        key: 'central',
                        label: 'Central',
                        count: MOCK_OBLIGATIONS.filter((o) => o.jurisdiction === 'central').length,
                      },
                      {
                        key: 'state',
                        label: 'State',
                        count: MOCK_OBLIGATIONS.filter((o) => o.jurisdiction === 'state').length,
                      },
                    ] as const
                  ).map((j) => {
                    const active = jurisdictionFilter === j.key;
                    return (
                      <li key={j.key}>
                        <button
                          type="button"
                          onClick={() => setJurisdictionFilter(j.key)}
                          className={`w-full flex items-center justify-between text-left py-1 ${
                            active ? 'text-ink' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          <span
                            className={`text-sm font-sans ${active ? 'font-medium' : ''}`}
                          >
                            {j.label}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                            {j.count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Status */}
              <div className="px-4 py-4">
                <p className="text-[10px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
                  Status
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-sans text-ink-soft">
                      <span className="w-1.5 h-1.5 bg-filed" aria-hidden />
                      Active
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                      {OBLIGATION_STATUS_COUNTS.active}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-sans text-ink-soft">
                      <span className="w-1.5 h-1.5 bg-due-soon" aria-hidden />
                      Draft
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                      {OBLIGATION_STATUS_COUNTS.draft}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-sans text-ink-soft">
                      <span className="w-1.5 h-1.5 bg-ink-muted" aria-hidden />
                      Deprecated
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                      {OBLIGATION_STATUS_COUNTS.deprecated}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </aside>

          {/* Main table */}
          <div className="col-span-12 lg:col-span-9">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-serif text-xl text-ink leading-none">
                {lawFilter === 'all'
                  ? 'All obligations'
                  : LAW_GROUPS.find((g) => g.key === lawFilter)?.label}
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                {filtered.length} of {MOCK_OBLIGATIONS.length} rules shown
              </span>
            </div>
            <div className="bg-paper-raised border border-rule">
              <DataTable
                columns={OBLIGATION_COLUMNS}
                rows={filtered}
                getRowKey={(o) => o.id}
                onRowClick={() => {}}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
