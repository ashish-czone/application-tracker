import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { DataTable, Pagination, CoarseTabs } from '@packages/ui';
import {
  MOCK_CLIENT_DETAIL,
  type ClientFilingStatus,
} from './data/clientDetailMock';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { ClientDetailHeader } from './components/ClientDetailHeader';
import { ClientDetailOverview } from './components/ClientDetailOverview';
import { CLIENT_DETAIL_FILING_COLUMNS } from './components/clientDetailFilingColumns';
import { CLIENT_DETAIL_LAW_COLUMNS } from './components/clientDetailLawColumns';

type DetailTab = 'overview' | 'filings' | 'laws';

export function ClientDetailPage() {
  const client = MOCK_CLIENT_DETAIL;

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [filingsPage, setFilingsPage] = useState(1);
  const [filingsPageSize, setFilingsPageSize] = useState(10);
  const [filingStatusTab, setFilingStatusTab] = useState<'all' | ClientFilingStatus>('all');

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
  ];

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="clients" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-6">
          <Link
            to="/screens/clients"
            className="flex items-center gap-1 hover:text-ink transition-colors"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.5} />
            <span>Clients</span>
          </Link>
          <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
          <span className="text-ink">{client.name}</span>
        </div>

        <ClientDetailHeader client={client} />

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
                columns={CLIENT_DETAIL_LAW_COLUMNS}
                visibleColumns={CLIENT_DETAIL_LAW_COLUMNS.map((c) => c.key)}
                rows={client.registeredLawDetails}
                getRowKey={(l) => l.id}
                onRowClick={() => {}}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
