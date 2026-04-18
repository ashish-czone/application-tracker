import type { UserStatus } from '../data/usersMock';

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
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised">
      <span className={`w-1.5 h-1.5 flex-none ${STATUS_DOT[status]}`} aria-hidden />
      <span className="text-ink-soft">{STATUS_LABEL[status]}</span>
    </span>
  );
}
