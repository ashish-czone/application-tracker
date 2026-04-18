import { AvatarBadge, type DataTableColumn } from '@packages/ui';
import { HealthBar, OrdinalDate } from '../../../../../../components';
import type { ComplianceRow, OverdueRow, WorkloadRow } from '../data/reportsMock';
import { PriorityPill } from './PriorityPill';

export const COMPLIANCE_COLUMNS: DataTableColumn<ComplianceRow>[] = [
  {
    key: 'client',
    header: 'Client',
    cell: (r) => (
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="w-7 h-7 flex-none flex items-center justify-center text-[9px] font-sans font-semibold text-paper-raised"
          style={{ backgroundColor: r.color }}
        >
          {r.initials}
        </span>
        <span className="text-sm text-ink font-sans truncate">{r.clientName}</span>
      </div>
    ),
  },
  {
    key: 'totalFilings',
    header: 'Total',
    width: '80px',
    align: 'right',
    cell: (r) => <span className="font-mono text-sm tabular-nums text-ink">{r.totalFilings}</span>,
  },
  {
    key: 'onTime',
    header: 'On time',
    width: '80px',
    align: 'right',
    cell: (r) => <span className="font-mono text-sm tabular-nums text-filed">{r.onTime}</span>,
  },
  {
    key: 'late',
    header: 'Late',
    width: '80px',
    align: 'right',
    cell: (r) => (
      <span className={`font-mono text-sm tabular-nums ${r.late > 0 ? 'text-due-soon' : 'text-ink-muted'}`}>
        {r.late || '—'}
      </span>
    ),
  },
  {
    key: 'overdue',
    header: 'Overdue',
    width: '80px',
    align: 'right',
    cell: (r) => (
      <span
        className={`font-mono text-sm tabular-nums ${r.overdue > 0 ? 'text-signal font-medium' : 'text-ink-muted'}`}
      >
        {r.overdue || '—'}
      </span>
    ),
  },
  {
    key: 'onTimeRate',
    header: 'On-time rate',
    width: '150px',
    cell: (r) => <HealthBar pct={r.onTimeRate} />,
  },
];

export const OVERDUE_COLUMNS: DataTableColumn<OverdueRow>[] = [
  {
    key: 'priority',
    header: 'Priority',
    width: '100px',
    cell: (r) => <PriorityPill priority={r.priority} />,
  },
  {
    key: 'filing',
    header: 'Filing',
    cell: (r) => (
      <div className="min-w-0">
        <span className="text-sm text-ink font-sans truncate block">{r.filingName}</span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
          {r.lawCode}
        </span>
      </div>
    ),
  },
  {
    key: 'client',
    header: 'Client',
    width: '180px',
    cell: (r) => (
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden
          className="w-6 h-6 flex-none flex items-center justify-center text-[9px] font-sans font-semibold text-paper-raised"
          style={{ backgroundColor: r.clientColor }}
        >
          {r.clientInitials}
        </span>
        <span className="text-sm text-ink font-sans truncate">{r.clientName}</span>
      </div>
    ),
  },
  {
    key: 'dueDate',
    header: 'Due date',
    width: '110px',
    cell: (r) => <OrdinalDate date={r.dueDate} variant="short" className="text-[11px]" />,
  },
  {
    key: 'daysOverdue',
    header: 'Days overdue',
    width: '110px',
    align: 'right',
    cell: (r) => {
      const tone =
        r.daysOverdue > 15
          ? 'text-signal font-medium'
          : r.daysOverdue > 7
            ? 'text-due-soon'
            : 'text-ink';
      return <span className={`font-mono text-sm tabular-nums ${tone}`}>{r.daysOverdue}d</span>;
    },
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '120px',
    cell: (r) => (
      <div className="flex items-center gap-2">
        <AvatarBadge initials={r.handlerInitials} size="xs" />
        <span className="text-[11px] font-sans text-ink-soft truncate">
          {r.handler.split(' ')[0]}
        </span>
      </div>
    ),
  },
];

export const WORKLOAD_COLUMNS: DataTableColumn<WorkloadRow>[] = [
  {
    key: 'name',
    header: 'Team member',
    cell: (r) => (
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="w-7 h-7 flex-none flex items-center justify-center text-[9px] font-sans font-semibold text-paper-raised"
          style={{ backgroundColor: r.color }}
        >
          {r.initials}
        </span>
        <div className="min-w-0">
          <span className="text-sm text-ink font-sans truncate block">{r.name}</span>
          <span className="text-[10px] font-sans text-ink-muted">{r.role}</span>
        </div>
      </div>
    ),
  },
  {
    key: 'totalAssigned',
    header: 'Assigned',
    width: '90px',
    align: 'right',
    cell: (r) => <span className="font-mono text-sm tabular-nums text-ink">{r.totalAssigned}</span>,
  },
  {
    key: 'completed',
    header: 'Completed',
    width: '100px',
    align: 'right',
    cell: (r) => <span className="font-mono text-sm tabular-nums text-filed">{r.completed}</span>,
  },
  {
    key: 'inProgress',
    header: 'In progress',
    width: '100px',
    align: 'right',
    cell: (r) => (
      <span className="font-mono text-sm tabular-nums text-authority">{r.inProgress}</span>
    ),
  },
  {
    key: 'overdue',
    header: 'Overdue',
    width: '80px',
    align: 'right',
    cell: (r) => (
      <span
        className={`font-mono text-sm tabular-nums ${r.overdue > 0 ? 'text-signal font-medium' : 'text-ink-muted'}`}
      >
        {r.overdue || '—'}
      </span>
    ),
  },
  {
    key: 'onTimeRate',
    header: 'On-time rate',
    width: '150px',
    cell: (r) => <HealthBar pct={r.onTimeRate} />,
  },
  {
    key: 'avgDays',
    header: 'Avg. days',
    width: '90px',
    align: 'right',
    cell: (r) => (
      <span className="font-mono text-sm tabular-nums text-ink-soft">
        {r.avgDaysToComplete.toFixed(1)}
      </span>
    ),
  },
];
