import { type DataTableColumn } from '@packages/ui';
import { OrdinalDate } from '../../../../../components';
import type { ActivityEntry } from '../data/settingsMock';

export const ACTIVITY_COLUMNS: DataTableColumn<ActivityEntry>[] = [
  {
    key: 'action',
    header: 'Action',
    width: '160px',
    cell: (e) => <span className="text-sm font-sans font-medium text-ink">{e.action}</span>,
  },
  {
    key: 'entity',
    header: 'Entity',
    cell: (e) => <span className="text-sm font-sans text-ink">{e.entity}</span>,
  },
  {
    key: 'detail',
    header: 'Detail',
    cell: (e) => (
      <span className="text-[11px] font-serif italic text-ink-muted">{e.detail}</span>
    ),
  },
  {
    key: 'ip',
    header: 'IP address',
    width: '130px',
    cell: (e) => (
      <span className="font-mono text-[11px] text-ink-muted tabular-nums">{e.ip}</span>
    ),
  },
  {
    key: 'timestamp',
    header: 'When',
    width: '120px',
    cell: (e) => <OrdinalDate date={e.timestamp} variant="short" className="text-[11px]" />,
  },
];
