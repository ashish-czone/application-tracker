import React, { useMemo, useState, useRef, useCallback } from 'react';
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
import { useClientsList } from '../../../../hooks/useClientsApi';
import { useUsersList } from '../../../../hooks/useUsersApi';
import { mapClientRecordToRow } from './api/mapClientRecord';
import { formatUserDisplayName } from './handlerUtils';

type StatusTab = 'all' | ClientStatus;

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
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [riskFilter, setRiskFilter] = useState<ClientRiskLevel[]>([]);
  const [handlerFilter, setHandlerFilter] = useState<string[]>([]);

  const { data, isLoading, isError } = useClientsList({ limit: 100 });
  const { data: usersData } = useUsersList({ limit: 500 });

  const rows = useMemo<ClientRow[]>(() => {
    if (!data?.data) return [];
    return data.data.map(mapClientRecordToRow);
  }, [data]);

  const userById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usersData?.data ?? []) {
      if (u.status !== 'active') continue;
      map.set(u.id, formatUserDisplayName(u));
    }
    return map;
  }, [usersData]);

  const statusCounts = useMemo(
    () => ({
      active: rows.filter((c) => c.status === 'active').length,
      onboarding: rows.filter((c) => c.status === 'onboarding').length,
      dormant: rows.filter((c) => c.status === 'dormant').length,
    }),
    [rows],
  );

  const riskCounts = useMemo(
    () => ({
      healthy: rows.filter((c) => c.status === 'active' && c.risk === 'healthy').length,
      'at-risk': rows.filter((c) => c.status === 'active' && c.risk === 'at-risk').length,
      critical: rows.filter((c) => c.status === 'active' && c.risk === 'critical').length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (statusTab !== 'all' && c.status !== statusTab) return false;
      if (riskFilter.length > 0 && !riskFilter.includes(c.risk)) return false;
      if (handlerFilter.length > 0 && !handlerFilter.includes(c.primaryHandler.id)) return false;
      if (q && !`${c.name} ${c.legalName} ${c.taxIdentifier}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rows, statusTab, riskFilter, handlerFilter, search]);

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
      chips.push({
        key: `handler:${key}`,
        group: 'Handler',
        value: userById.get(key) ?? key,
        onRemove: () => setHandlerFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    return chips;
  }, [riskFilter, handlerFilter, userById]);

  const clearAll = () => {
    setRiskFilter([]);
    setHandlerFilter([]);
  };

  const totalClients = rows.length;
  const activeClients = statusCounts.active;
  const totalOverdue = rows.reduce((acc, c) => acc + c.overdueFilings, 0);
  const onTimeClients = rows.filter((c) => c.onTimePct > 0);
  const avgOnTime =
    onTimeClients.length > 0
      ? Math.round(onTimeClients.reduce((acc, c) => acc + c.onTimePct, 0) / onTimeClients.length)
      : 0;
  const totalRegistrations = rows.reduce((acc, c) => acc + c.registeredLaws, 0);
  const clientsWithOverdue = rows.filter((c) => c.overdueFilings > 0).length;

  const riskOptions = RISK_OPTIONS.map((r) => ({
    value: r.value,
    label: r.label,
    count: rows.filter((c) => c.risk === r.value && c.status === 'active').length,
  }));

  const handlerOptions = useMemo(
    () =>
      Array.from(userById.entries())
        .map(([id, label]) => ({
          value: id,
          label,
          count: rows.filter((c) => c.primaryHandler.id === id).length,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [userById, rows],
  );

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalClients },
    { value: 'active' as const, label: 'Active', count: statusCounts.active },
    { value: 'onboarding' as const, label: 'Onboarding', count: statusCounts.onboarding },
    { value: 'dormant' as const, label: 'Dormant', count: statusCounts.dormant },
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
              {statusCounts.onboarding} onboarding, {statusCounts.dormant} dormant.
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
            delta: '▲ 1 this month',
            deltaTone: 'positive',
            accent: 'authority',
            sparklineData: [8, 9, 9, 10, 10, 11, totalClients],
            sparklineTone: 'authority',
            footnote: `${activeClients} active`,
          },
          {
            label: 'Registrations',
            value: String(totalRegistrations),
            unit: 'law links',
            delta: `across ${activeClients} clients`,
            deltaTone: 'neutral',
            accent: 'filed',
            sparklineData: [32, 35, 37, 40, 42, 44, totalRegistrations],
            sparklineTone: 'filed',
            footnote: 'avg 3.8 per client',
          },
          {
            label: 'Overdue filings',
            value: String(totalOverdue),
            unit: 'filings',
            delta: `across ${clientsWithOverdue} clients`,
            deltaTone: 'negative',
            accent: 'signal',
            sparklineData: [5, 7, 8, 9, 10, 11, totalOverdue],
            sparklineTone: 'signal',
            footnote: `${riskCounts.critical} critical`,
          },
          {
            label: 'Avg. on-time rate',
            value: String(avgOnTime),
            unit: '%',
            delta: '▲ 1.2 vs Q4',
            deltaTone: 'positive',
            accent: 'filed',
            sparklineData: [84, 85, 86, 87, 88, 89, avgOnTime],
            sparklineTone: 'filed',
            footnote: 'trailing 12 months',
          },
        ]}
      >
        <section className="mt-10">
          <CoarseTabs tabs={statusTabs} value={statusTab} onChange={setStatusTab} animated />

          <DataGridShell
            columns={CLIENT_COLUMNS}
            rows={filtered}
            getRowKey={(c) => c.id}
            requiredColumns={REQUIRED_CLIENT_COLUMN_KEYS}
            totalRows={totalClients}
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
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {drawerOpen && <NewClientDrawer onClose={() => setDrawerOpen(false)} />}
      </AnimatePresence>

      {hoveredClient && <ClientPreviewPopover client={hoveredClient} anchorRect={hoverRect} />}
    </>
  );
}
