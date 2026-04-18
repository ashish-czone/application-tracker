import type { ClientFilingStatus } from '../data/clientDetailMock';

export const CLIENT_FILING_STATUS_LABEL: Record<ClientFilingStatus, string> = {
  overdue: 'Overdue',
  'due-today': 'Due today',
  'due-this-week': 'Due this week',
  upcoming: 'Upcoming',
  filed: 'Filed',
};

export const CLIENT_FILING_STATUS_DOT: Record<ClientFilingStatus, string> = {
  overdue: 'bg-signal',
  'due-today': 'bg-signal',
  'due-this-week': 'bg-due-soon',
  upcoming: 'bg-ink-muted',
  filed: 'bg-filed',
};

export interface ClientFilingStatusBadgeProps {
  status: ClientFilingStatus;
}

export function ClientFilingStatusBadge({ status }: ClientFilingStatusBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised">
      <span className={`w-1.5 h-1.5 flex-none ${CLIENT_FILING_STATUS_DOT[status]}`} aria-hidden />
      <span className="text-ink-soft">{CLIENT_FILING_STATUS_LABEL[status]}</span>
    </span>
  );
}
