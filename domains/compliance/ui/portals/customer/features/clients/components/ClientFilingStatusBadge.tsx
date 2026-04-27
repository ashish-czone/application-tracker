import { Pill } from '../../../../../components';
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
    <Pill tone={CLIENT_FILING_STATUS_DOT[status]}>{CLIENT_FILING_STATUS_LABEL[status]}</Pill>
  );
}
