import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { DataTable, Pagination, CoarseTabs } from '@packages/ui';
import { AuditTimeline } from '@packages/audit-ui';
import { CLIENT_DETAIL_PLACEHOLDER } from './placeholders';
import type { ClientFilingStatus, ClientLaw } from './types';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { InactiveStateBanner } from '../../../../components';
import { ClientDetailHeader } from './components/ClientDetailHeader';
import { ClientDetailOverview } from './components/ClientDetailOverview';
import { CLIENT_DETAIL_FILING_COLUMNS } from './components/clientDetailFilingColumns';
import { makeClientDetailLawColumns } from './components/clientDetailLawColumns';
import { RegistrationDeactivationDialog } from './components/RegistrationDeactivationDialog';
import { useClientDetail } from '../../../../hooks/useClientsApi';
import { mergeClientDetail } from './api/mapClientRecord';

type DetailTab = 'overview' | 'filings' | 'laws' | 'audit-trail';

export function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { data: record, isLoading, isError } = useClientDetail(clientId);

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [filingsPage, setFilingsPage] = useState(1);
  const [filingsPageSize, setFilingsPageSize] = useState(10);
  const [filingStatusTab, setFilingStatusTab] = useState<'all' | ClientFilingStatus>('all');
  const [deactivating, setDeactivating] = useState<ClientLaw | null>(null);

  const lawColumns = useMemo(
    () => makeClientDetailLawColumns({ onDeactivate: setDeactivating }),
    [],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper paper-grain">
        <ScreenPreviewTopBar active="clients" />
        <main className="max-w-[1480px] mx-auto px-10 py-8">
          <p className="font-mono text-[11px] tracking-tabular text-ink-muted">Loading client…</p>
        </main>
      </div>
    );
  }

  if (isError || !record) {
    return (
      <div className="min-h-screen bg-paper paper-grain">
        <ScreenPreviewTopBar active="clients" />
        <main className="max-w-[1480px] mx-auto px-10 py-8">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-6">
            <Link
              to="/clients"
              className="flex items-center gap-1 hover:text-ink transition-colors"
            >
              <ChevronLeft className="w-3 h-3" strokeWidth={1.5} />
              <span>Clients</span>
            </Link>
          </div>
          <div className="border border-rule bg-paper-raised p-8 text-center">
            <p className="font-serif italic text-ink-soft">Client not found.</p>
          </div>
        </main>
      </div>
    );
  }

  const client = mergeClientDetail(record, CLIENT_DETAIL_PLACEHOLDER);

  const filingsPageCount = Math.max(1, Math.ceil(client.recentFilings.length / filingsPageSize));
  const paginatedFilings = client.recentFilings.slice(
    (filingsPage - 1) * filingsPageSize,
    filingsPage * filingsPageSize,
  );
  const filteredFilings =
    filingStatusTab === 'all'
      ? paginatedFilings
      : client.recentFilings.filter((f) => f.status === filingStatusTab);

  const filingStatusTabs = [
    { value: 'all' as const, label: 'All', count: client.recentFilings.length },
    {
      value: 'overdue' as const,
      label: 'Overdue',
      count: client.recentFilings.filter((f) => f.status === 'overdue').length,
    },
    {
      value: 'due-today' as const,
      label: 'Due today',
      count: client.recentFilings.filter((f) => f.status === 'due-today').length,
    },
    {
      value: 'upcoming' as const,
      label: 'Upcoming',
      count: client.recentFilings.filter((f) => f.status === 'upcoming').length,
    },
    {
      value: 'filed' as const,
      label: 'Filed',
      count: client.recentFilings.filter((f) => f.status === 'filed').length,
    },
  ];

  const detailTabs = [
    { value: 'overview' as const, label: 'Overview' },
    { value: 'filings' as const, label: 'Filings', count: client.openFilings },
    { value: 'laws' as const, label: 'Laws', count: client.registeredLaws },
    { value: 'audit-trail' as const, label: 'Audit Trail' },
  ];

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="clients" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-6">
          <Link
            to="/clients"
            className="flex items-center gap-1 hover:text-ink transition-colors"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.5} />
            <span>Clients</span>
          </Link>
          <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
          <span className="text-ink">{client.name}</span>
        </div>

        <ClientDetailHeader client={client} />

        {client.status === 'dormant' && <InactiveStateBanner kind="dormant" />}

        <CoarseTabs animated tabs={detailTabs} value={activeTab} onChange={setActiveTab} />

        <div className="mt-6">
          {activeTab === 'overview' && <ClientDetailOverview client={client} />}

          {activeTab === 'filings' && (
            <div>
              <CoarseTabs
                animated
                tabs={filingStatusTabs}
                value={filingStatusTab}
                onChange={setFilingStatusTab}
              />
              <div className="mt-4 bg-paper-raised border border-rule overflow-x-auto">
                <DataTable
                  columns={CLIENT_DETAIL_FILING_COLUMNS}
                  visibleColumns={CLIENT_DETAIL_FILING_COLUMNS.map((c) => c.key)}
                  rows={filingStatusTab === 'all' ? paginatedFilings : filteredFilings}
                  getRowKey={(f) => f.id}
                  onRowClick={() => {}}
                />
                {filingStatusTab === 'all' && (
                  <Pagination
                    page={filingsPage}
                    pageSize={filingsPageSize}
                    pageCount={filingsPageCount}
                    totalRows={client.recentFilings.length}
                    onPageChange={setFilingsPage}
                    onPageSizeChange={(size) => {
                      setFilingsPageSize(size);
                      setFilingsPage(1);
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'laws' && (
            <div className="bg-paper-raised border border-rule overflow-x-auto">
              <DataTable
                columns={lawColumns}
                visibleColumns={lawColumns.map((c) => c.key)}
                rows={client.registeredLawDetails}
                getRowKey={(l) => l.id}
                onRowClick={() => {}}
              />
            </div>
          )}

          {activeTab === 'audit-trail' && clientId && (
            <div className="bg-paper-raised border border-rule p-6">
              <AuditTimeline entityType="clients" entityId={clientId} />
            </div>
          )}
        </div>

        {deactivating && (
          <RegistrationDeactivationDialog
            open={!!deactivating}
            onOpenChange={(open) => { if (!open) setDeactivating(null); }}
            clientId={deactivating.clientId}
            lawId={deactivating.lawId}
            lawLabel={`${deactivating.code} — ${deactivating.name}`}
            onDeactivated={() => setDeactivating(null)}
          />
        )}
      </main>
    </div>
  );
}
