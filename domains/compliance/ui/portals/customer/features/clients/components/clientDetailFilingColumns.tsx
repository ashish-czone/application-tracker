import { type DataTableColumn } from '@packages/ui';
import { OrdinalDate, HandlerPill, JurisdictionTag } from '../../../../../components';
import type { ClientFiling } from '../data/clientDetailMock';
import { ClientFilingStatusBadge } from './ClientFilingStatusBadge';

export const CLIENT_DETAIL_FILING_COLUMNS: DataTableColumn<ClientFiling>[] = [
  {
    key: 'lawCode',
    header: 'Filing',
    cell: (f) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-ink tracking-wide">{f.lawCode}</span>
          <JurisdictionTag jurisdiction={f.jurisdiction} variant="muted" />
        </div>
        <span className="text-[11px] font-sans text-ink-muted mt-0.5 block truncate">
          {f.ruleName}
        </span>
      </div>
    ),
  },
  {
    key: 'period',
    header: 'Period',
    width: '100px',
    cell: (f) => <span className="font-mono text-[11px] text-ink-soft">{f.period}</span>,
  },
  {
    key: 'dueDate',
    header: 'Due',
    width: '100px',
    cell: (f) => <OrdinalDate date={f.dueDate} variant="short" className="text-[11px]" />,
  },
  {
    key: 'filedDate',
    header: 'Filed',
    width: '100px',
    cell: (f) =>
      f.filedDate ? (
        <OrdinalDate date={f.filedDate} variant="short" className="text-[11px]" />
      ) : (
        <span className="text-ink-muted text-[11px]">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '120px',
    cell: (f) => <ClientFilingStatusBadge status={f.status} />,
  },
  {
    key: 'priority',
    header: 'Priority',
    width: '90px',
    cell: (f) => (
      <span
        className={`text-[11px] font-sans font-semibold uppercase tracking-eyebrow ${
          f.priority === 'critical'
            ? 'text-signal'
            : f.priority === 'high'
              ? 'text-due-soon'
              : 'text-ink-muted'
        }`}
      >
        {f.priority}
      </span>
    ),
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '110px',
    cell: (f) => <HandlerPill initials={f.handler.initials} name={f.handler.name} />,
  },
];
