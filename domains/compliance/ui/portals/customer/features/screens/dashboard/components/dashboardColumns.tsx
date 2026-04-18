import type { DataTableColumn } from '@packages/ui';
import { UrgencyBadge, JurisdictionTag, OrdinalDate } from '../../../../../../components';
import type { Filing } from '../../../../../../shared';

export const DASHBOARD_COLUMNS: DataTableColumn<Filing>[] = [
  {
    key: 'status',
    header: 'Status',
    width: '150px',
    cell: (f) => <UrgencyBadge urgency={f.status} />,
  },
  {
    key: 'client',
    header: 'Client',
    cell: (f) => (
      <div className="flex flex-col">
        <span className="text-ink font-sans">{f.clientName}</span>
        <span className="font-serif italic text-[11px] text-ink-muted">{f.periodLabel}</span>
      </div>
    ),
  },
  {
    key: 'law',
    header: 'Law',
    cell: (f) => (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-muted tracking-tabular uppercase">
          {f.lawCode}
        </span>
        <JurisdictionTag jurisdiction={f.jurisdiction} />
      </div>
    ),
  },
  {
    key: 'due',
    header: 'Due',
    width: '120px',
    cell: (f) => <OrdinalDate date={f.dueDate} variant="short" className="text-sm" />,
  },
];
