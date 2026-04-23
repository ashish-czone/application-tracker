import { type DataTableColumn } from '@packages/ui';
import { OrdinalDate, UrgencyBadge, JurisdictionTag, HandlerPill } from '../../../../../../components';
import type { FilingRow } from '../data/filingTypes';

const PRIORITY_TONE: Record<string, string> = {
  critical: 'text-signal',
  high: 'text-due-soon',
  normal: 'text-ink-muted',
  low: 'text-ink-muted/60',
};

export const FILING_COLUMNS: DataTableColumn<FilingRow>[] = [
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
      <span
        className={`text-[11px] uppercase tracking-eyebrow font-sans font-medium ${PRIORITY_TONE[f.priority]}`}
      >
        {f.priority}
      </span>
    ),
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '120px',
    cell: (f) =>
      f.handler ? <HandlerPill initials={f.handler.initials} name={f.handler.name} /> : null,
  },
];

export const ALL_FILING_COLUMN_KEYS = FILING_COLUMNS.map((c) => c.key);
export const REQUIRED_FILING_COLUMN_KEYS: string[] = ['filing'];
