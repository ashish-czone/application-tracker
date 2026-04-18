import type { OverdueRow } from '../data/reportsMock';

export interface PriorityPillProps {
  priority: OverdueRow['priority'];
}

export function PriorityPill({ priority }: PriorityPillProps) {
  const tone =
    priority === 'critical'
      ? 'bg-signal'
      : priority === 'high'
        ? 'bg-due-soon'
        : 'bg-ink-muted';
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised">
      <span className={`w-1.5 h-1.5 flex-none ${tone}`} aria-hidden />
      <span className="text-ink-soft">{label}</span>
    </span>
  );
}
