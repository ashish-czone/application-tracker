import { AlertTriangle, Clock } from 'lucide-react';
import type { OverdueRow } from '../types';

export interface SeverityBreakdownProps {
  rows: OverdueRow[];
}

export function SeverityBreakdown({ rows }: SeverityBreakdownProps) {
  const critical = rows.filter((r) => r.priority === 'critical').length;
  const high = rows.filter((r) => r.priority === 'high').length;
  const medium = rows.filter((r) => r.priority === 'medium').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-signal" strokeWidth={1.5} />
          <span className="text-sm font-sans text-ink">Critical</span>
        </div>
        <span className="font-mono text-lg tabular-nums text-signal font-medium">{critical}</span>
      </div>
      <div className="border-t border-rule" />
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-due-soon" strokeWidth={1.5} />
          <span className="text-sm font-sans text-ink">High</span>
        </div>
        <span className="font-mono text-lg tabular-nums text-due-soon font-medium">{high}</span>
      </div>
      <div className="border-t border-rule" />
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
          <span className="text-sm font-sans text-ink">Medium</span>
        </div>
        <span className="font-mono text-lg tabular-nums text-ink-soft font-medium">{medium}</span>
      </div>
    </div>
  );
}
