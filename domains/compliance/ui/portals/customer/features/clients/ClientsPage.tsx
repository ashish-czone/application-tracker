import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { Plus, Upload, AlertTriangle } from 'lucide-react';
import {
  DataGridShell,
  Button,
  FilterPopover,
  CoarseTabs,
  SearchInput,
  ScreenLayout,
  type ActiveFilter,
} from '@packages/ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  type ClientRow,
  type ClientStatus,
  type ClientRiskLevel,
} from './types';
import { RISK_OPTIONS } from './filterOptions';
import { NewClientDrawer } from './components/NewClientDrawer';
import { ClientPreviewPopover } from './components/ClientPreviewPopover';
import { RISK_LABEL } from './components/RiskPill';
import { CLIENT_COLUMNS, REQUIRED_CLIENT_COLUMN_KEYS } from './components/clientColumns';
import {
  useClientsList,
  useClientsSummary,
  useClientHandlerOptions,
} from '../../../../hooks/useClientsApi';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { mapClientRecordToRow } from './api/mapClientRecord';

type StatusTab = 'all' | ClientStatus;

const PAGE_LIMIT = 25;

export function ClientsPage() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [hoveredClient, setHoveredClient] = useState<ClientRow | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowMouseEnter = useCallback(
    (client: ClientRow, e: React.MouseEvent<HTMLTableRowElement>) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      const rect = e.currentTarget.getBoundingClientRect();
      hoverTimerRef.current = setTimeout(() => {
        setHoveredClient(client);
        setHoverRect(rect);
      }, 400);
    },
    [],
  );

  const handleRowMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredClient(null);
      setHoverRect(null);
    }, 150);
  }, []);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [riskFilter, setRiskFilter] = useState<ClientRiskLevel[]>([]);
  const [handlerFilter, setHandlerFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever filters change so page never lands past the
  // available range. Without this, switching tabs leaves the page index
  // pointing at empty pages and the user sees "no rows" until they navigate.
  useEffect(() => {
    setPage(1);
  }, [statusTab, riskFilter, handlerFilter, debouncedSearch]);

  const { data, isLoading, isError } = useClientsList({
    page,
    limit: PAGE_LIMIT,
    status: statusTab === 'all' ? undefined : statusTab,
    risk: riskFilter.length > 0 ? riskFilter.join(',') : undefined,
    handlerId: handlerFilter.length > 0 ? handlerFilter.join(',') : undefined,
    q: debouncedSearch || undefined,
  });
  const { data: summary } = useClientsSummary();
  const { data: handlerOptionsRaw } = useClientHandlerOptions();

  const rows = useMemo<ClientRow[]>(
    () => data?.data?.map(mapClientRecordToRow) ?? [],
    [data],
  );
  const totalPages = data?.meta?.totalPages ?? 1;
  const totalRows = data?.meta?.total ?? 0;

  const totalClients = summary?.total ?? 0;
  const activeClients = summary?.byStatus.active ?? 0;
  const onboardingClients = summary?.byStatus.onboarding ?? 0;
  const dormantClients = summary?.byStatus.dormant ?? 0;
  const riskCounts = summary?.byRisk ?? { healthy: 0, 'at-risk': 0, critical: 0 };
  const totalOverdue = summary?.totalOverdue ?? 0;
  const clientsWithOverdue = summary?.clientsWithOverdue ?? 0;
  const totalRegistrations = summary?.totalRegistrations ?? 0;
  const avgOnTime = summary?.avgOnTimePct ?? 0;

  const riskOptions = RISK_OPTIONS.map((r) => ({
    value: r.value,
    label: r.label,
  }));

  const handlerOptions = useMemo(
    () =>
      (handlerOptionsRaw ?? [])
        .map((h) => ({ value: h.id, label: h.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [handlerOptionsRaw],
  );

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
      const handler = handlerOptionsRaw?.find((h) => h.id === key);
      chips.push({
        key: `handler:${key}`,
        group: 'Handler',
        value: handler?.name ?? key,
        onRemove: () => setHandlerFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    return chips;
  }, [riskFilter, handlerFilter, handlerOptionsRaw]);

  const clearAll = () => {
    setRiskFilter([]);
    setHandlerFilter([]);
  };

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalClients },
    { value: 'active' as const, label: 'Active', count: activeClients },
    { value: 'onboarding' as const, label: 'Onboarding', count: onboardingClients },
    { value: 'dormant' as const, label: 'Dormant', count: dormantClients },
  ];

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="clients" />}
        breadcrumb={['Portfolio', 'Clients']}
        title="Clients"
        subtitle={
          isLoading ? (
            <>Loading clients…</>
          ) : isError ? (
            <span className="text-signal">Failed to load clients. Refresh to retry.</span>
          ) : (
            <>
              {totalClients} entities under management — {activeClients} active,{' '}
              {onboardingClients} onboarding, {dormantClients} dormant.
            </>
          )
        }
        actions={
          <>
            <Button variant="outline" size="sm">
              <Upload className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Import
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Add client
            </Button>
          </>
        }
        alert={
          totalOverdue > 0 && (
            <div className="border border-signal/40 bg-signal/5 px-5 py-3 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-signal flex-shrink-0" strokeWidth={2} />
              <p className="flex-1 text-sm text-ink">
                <span className="font-sans font-medium">
                  {riskCounts.critical} client
                  {riskCounts.critical !== 1 ? 's' : ''} in critical status
                </span>{' '}
                <span className="text-ink-soft">
                  with {totalOverdue} overdue filings across the portfolio.
                </span>
              </p>
              <button
                type="button"
                className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-signal hover:underline"
                onClick={() => setRiskFilter(['critical'])}
              >
                Review →
              </button>
            </div>
          )
        }
        kpis={[
          {
            label: 'Total clients',
            value: String(totalClients),
            unit: 'entities',
            delta: `${activeClients} active`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [totalClients, totalClients, totalClients, totalClients, totalClients, totalClients, totalClients],
            sparklineTone: 'authority',
            footnote: `${onboardingClients} onboarding · ${dormantClients} dormant`,
          },
          {
            label: 'Registrations',
            value: String(totalRegistrations),
            unit: 'law links',
            delta: `across ${activeClients} clients`,
            deltaTone: 'neutral',
            accent: 'filed',
            sparklineData: [totalRegistrations, totalRegistrations, totalRegistrations, totalRegistrations, totalRegistrations, totalRegistrations, totalRegistrations],
            sparklineTone: 'filed',
            footnote:
              activeClients > 0
                ? `avg ${(totalRegistrations / activeClients).toFixed(1)} per active client`
                : '—',
          },
          {
            label: 'Overdue filings',
            value: String(totalOverdue),
            unit: 'filings',
            delta: `across ${clientsWithOverdue} clients`,
            deltaTone: totalOverdue > 0 ? 'negative' : 'neutral',
            accent: 'signal',
            sparklineData: [totalOverdue, totalOverdue, totalOverdue, totalOverdue, totalOverdue, totalOverdue, totalOverdue],
            sparklineTone: 'signal',
            footnote: `${riskCounts.critical} critical`,
          },
          {
            label: 'Avg. on-time rate',
            value: String(avgOnTime),
            unit: '%',
            delta: 'across completed filings',
            deltaTone: 'neutral',
            accent: 'filed',
            sparklineData: [avgOnTime, avgOnTime, avgOnTime, avgOnTime, avgOnTime, avgOnTime, avgOnTime],
            sparklineTone: 'filed',
            footnote: 'lifetime',
          },
        ]}
      >
        <section className="mt-10">
          <CoarseTabs tabs={statusTabs} value={statusTab} onChange={setStatusTab} animated />

          <DataGridShell
            columns={CLIENT_COLUMNS}
            rows={rows}
            getRowKey={(c) => c.id}
            requiredColumns={REQUIRED_CLIENT_COLUMN_KEYS}
            totalRows={totalRows}
            defaultPageSize={PAGE_LIMIT}
            onRowClick={(client) => {
              navigate(`/clients/${client.id}`);
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-3 border-t border-rule mt-2">
              <span className="text-[11px] font-sans tabular-nums text-ink-soft">
                Page {page} of {totalPages} · {totalRows} clients
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1 text-[11px] uppercase tracking-eyebrow font-sans font-medium border border-rule text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-[11px] uppercase tracking-eyebrow font-sans font-medium border border-rule text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {drawerOpen && <NewClientDrawer onClose={() => setDrawerOpen(false)} />}
      </AnimatePresence>

      {hoveredClient && <ClientPreviewPopover client={hoveredClient} anchorRect={hoverRect} />}
    </>
  );
}
