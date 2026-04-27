import { Button, type DataTableColumn } from '@packages/ui';
import {
  HealthBar,
  OrdinalDate,
  HandlerPill,
  JurisdictionTag,
  InactiveSourceMarker,
} from '../../../../../../components';
import type { ClientLaw } from '../data/clientDetailMock';

interface ColumnsOptions {
  /** Opens the deactivation dialog for the clicked row. */
  onDeactivate: (row: ClientLaw) => void;
}

export function makeClientDetailLawColumns({ onDeactivate }: ColumnsOptions): DataTableColumn<ClientLaw>[] {
  return [
    {
      key: 'code',
      header: 'Law',
      cell: (l) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium text-ink tracking-wide">{l.code}</span>
            <JurisdictionTag jurisdiction={l.jurisdiction} variant="muted" />
            {l.deactivatedAt && <InactiveSourceMarker kind="deactivated" />}
          </div>
          <span className="text-[11px] font-sans text-ink-muted mt-0.5 block truncate">
            {l.name}
          </span>
        </div>
      ),
    },
    {
      key: 'cadence',
      header: 'Cadence',
      width: '100px',
      cell: (l) => (
        <span className="text-[11px] font-sans text-ink-soft uppercase tracking-eyebrow font-medium">
          {l.cadence}
        </span>
      ),
    },
    {
      key: 'nextDue',
      header: 'Next due',
      width: '100px',
      cell: (l) => <OrdinalDate date={l.nextDue} variant="short" className="text-[11px]" />,
    },
    {
      key: 'openFilings',
      header: 'Open',
      width: '70px',
      align: 'right',
      cell: (l) => (
        <span className="font-mono text-sm tabular-nums text-ink">{l.openFilings}</span>
      ),
    },
    {
      key: 'overdueFilings',
      header: 'Overdue',
      width: '80px',
      align: 'right',
      cell: (l) => (
        <span
          className={`font-mono text-sm tabular-nums ${l.overdueFilings > 0 ? 'text-signal font-medium' : 'text-ink-muted'}`}
        >
          {l.overdueFilings || '—'}
        </span>
      ),
    },
    {
      key: 'onTimePct',
      header: 'On-time rate',
      width: '140px',
      cell: (l) => <HealthBar pct={l.onTimePct} />,
    },
    {
      key: 'handler',
      header: 'Handler',
      width: '110px',
      cell: (l) => <HandlerPill initials={l.handler.initials} name={l.handler.name} />,
    },
    {
      key: 'registeredAt',
      header: 'Since',
      width: '100px',
      cell: (l) => <OrdinalDate date={l.registeredAt} variant="short" className="text-[11px]" />,
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      align: 'right',
      cell: (l) =>
        l.deactivatedAt ? null : (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDeactivate(l);
            }}
            className="text-[11px] text-ink-muted hover:text-destructive"
          >
            Deactivate
          </Button>
        ),
    },
  ];
}
