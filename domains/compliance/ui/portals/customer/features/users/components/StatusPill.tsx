import { Pill } from '../../../../../components';
import type { UserStatus } from '../types';

export const STATUS_DOT: Record<UserStatus, string> = {
  active: 'bg-filed',
  invited: 'bg-due-soon',
  deactivated: 'bg-ink-muted',
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  deactivated: 'Deactivated',
};

export interface StatusPillProps {
  status: UserStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  return <Pill tone={STATUS_DOT[status]}>{STATUS_LABEL[status]}</Pill>;
}
