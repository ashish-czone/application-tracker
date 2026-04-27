import { Pill } from '../../../../../components';
import type { OverdueRow } from '../placeholders';

const PRIORITY_TONE: Record<OverdueRow['priority'], string> = {
  critical: 'bg-signal',
  high: 'bg-due-soon',
  medium: 'bg-ink-muted',
};

export interface PriorityPillProps {
  priority: OverdueRow['priority'];
}

export function PriorityPill({ priority }: PriorityPillProps) {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return <Pill tone={PRIORITY_TONE[priority]}>{label}</Pill>;
}
