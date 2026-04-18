import React, { useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { Plus, Upload, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  MetricKPI,
  DataGridShell,
  Button,
  FilterPopover,
  CoarseTabs,
  SearchInput,
  type DataTableColumn,
  type ActiveFilter,
} from '@packages/ui';
import { OrdinalDate } from '../../../../../components';
import {
  MOCK_CLIENT_ROWS,
  CLIENT_STATUS_COUNTS,
  CLIENT_RISK_COUNTS,
  type ClientRow,
  type ClientStatus,
  type ClientRiskLevel,
} from './clientsMock';
import { NewClientDrawer } from './NewClientDrawer';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

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

function ClientPreviewPopover({
  client,
  anchorRect,
}: {
  client: ClientRow;
  anchorRect: DOMRect | null;
}) {
  if (!anchorRect) return null;

  // Position below the row, aligned to the left of the name cell
  const top = anchorRect.bottom + 6;
  const left = Math.max(16, anchorRect.left);

  // Flip upward if it would overflow the viewport
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 900;
  const wouldOverflow = top + 200 > viewportH;
  const finalTop = wouldOverflow ? anchorRect.top - 206 : top;

  return (
    <div
      className="fixed z-50 w-[320px] border border-rule bg-paper-raised shadow-lg"
      style={{ top: finalTop, left }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <span
            aria-hidden
            className="w-9 h-9 flex-none flex items-center justify-center text-[11px] font-sans font-semibold text-paper-raised"
            style={{ backgroundColor: client.color }}
          >
            {client.initials}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-sans font-medium text-ink leading-snug truncate">
              {client.name}
            </div>
            <div className="font-serif italic text-[11px] text-ink-muted truncate">
              {client.legalName}
            </div>
          </div>
        </div>

        {/* Tax ID */}
        <div className="font-mono text-[10px] tracking-wide text-ink-muted mb-3">
          {client.taxIdentifier}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-px bg-rule border border-rule mb-3">
          <div className="bg-paper-raised p-2 text-center">
            <div className="font-mono text-sm tabular-nums text-ink">{client.openFilings || '—'}</div>
            <div className="text-[9px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">Open</div>
          </div>
          <div className="bg-paper-raised p-2 text-center">
            <div className={`font-mono text-sm tabular-nums ${client.overdueFilings > 0 ? 'text-signal' : 'text-ink'}`}>
              {client.overdueFilings || '—'}
            </div>
            <div className="text-[9px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">Overdue</div>
          </div>
          <div className="bg-paper-raised p-2 text-center">
            <div className="font-mono text-sm tabular-nums text-ink">
              {client.onTimePct > 0 ? `${client.onTimePct}%` : '—'}
            </div>
            <div className="text-[9px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">On-time</div>
          </div>
        </div>

        {/* Risk + handler row */}
        <div className="flex items-center justify-between">
          {client.status === 'active' ? (
            <RiskPill risk={client.risk} />
          ) : (
            <span className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted">
              {client.status}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="w-5 h-5 flex-none bg-authority text-paper-raised text-[9px] font-sans font-semibold flex items-center justify-center"
            >
              {client.primaryHandler.initials}
            </span>
            <span className="text-[11px] font-sans text-ink-soft">
              {client.primaryHandler.name.split(' ')[0]}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-rule px-4 py-2">
        <span className="text-[10px] font-sans text-ink-muted">
          Click row to view full profile →
        </span>
      </div>
    </div>
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

const REQUIRED_COLUMN_KEYS: string[] = ['name'];

// ─── Page ───────────────────────────────────────────────────────────

export function ClientsPage() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hover popover state
  const [hoveredClient, setHoveredClient] = useState<ClientRow | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowMouseEnter = useCallback((client: ClientRow, e: React.MouseEvent<HTMLTableRowElement>) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // Capture rect immediately — React nullifies currentTarget after the event handler returns
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimerRef.current = setTimeout(() => {
      setHoveredClient(client);
      setHoverRect(rect);
    }, 400);
  }, []);

  const handleRowMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredClient(null);
      setHoverRect(null);
    }, 150);
  }, []);

  // Filter state.
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [riskFilter, setRiskFilter] = useState<ClientRiskLevel[]>([]);
  const [handlerFilter, setHandlerFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
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
      <ScreenPreviewTopBar active="clients" />

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
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
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
            tabs={statusTabs}
            value={statusTab}
            onChange={setStatusTab}
            animated
          />

          <DataGridShell
            columns={CLIENT_COLUMNS}
            rows={filtered}
            getRowKey={(c) => c.id}
            requiredColumns={REQUIRED_COLUMN_KEYS}
            totalRows={totalClients}
            onRowClick={(client) => {
              navigate(`/screens/clients/${client.id}`);
            }}
            rowProps={(client) => ({
              onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) =>
                handleRowMouseEnter(client, e),
              onMouseLeave: handleRowMouseLeave,
            })}
            activeFilters={activeFilters}
            onClearFilters={clearAll}
            containerProps={{ onMouseLeave: handleRowMouseLeave }}
            filters={
              <>
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clients…"
                  wrapperClassName="min-w-[200px] max-w-xs flex-1"
                />
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
              </>
            }
          />
        </section>
      </main>

      <AnimatePresence>
        {drawerOpen && <NewClientDrawer onClose={() => setDrawerOpen(false)} />}
      </AnimatePresence>

      {hoveredClient && (
        <ClientPreviewPopover client={hoveredClient} anchorRect={hoverRect} />
      )}
    </div>
  );
}
