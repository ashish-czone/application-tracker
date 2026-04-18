import { type DataTableColumn } from '@packages/ui';
import { OrdinalDate, HealthBar, HandlerPill } from '../../../../../../components';
import type { ClientRow } from '../data/clientsMock';
import { RiskPill } from './RiskPill';

export const CLIENT_COLUMNS: DataTableColumn<ClientRow>[] = [
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
          <span className="text-sm text-ink font-sans leading-snug truncate block">{c.name}</span>
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
        className={`font-mono text-sm tabular-nums ${
          c.overdueFilings > 0 ? 'text-signal font-medium' : 'text-ink-muted'
        }`}
      >
        {c.overdueFilings || '—'}
      </span>
    ),
  },
  {
    key: 'onTimePct',
    header: 'On-time rate',
    width: '150px',
    cell: (c) =>
      c.onTimePct > 0 ? (
        <HealthBar pct={c.onTimePct} />
      ) : (
        <span className="text-ink-muted text-[11px]">—</span>
      ),
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '120px',
    cell: (c) => (
      <HandlerPill initials={c.primaryHandler.initials} name={c.primaryHandler.name} />
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

export const REQUIRED_CLIENT_COLUMN_KEYS: string[] = ['name'];
