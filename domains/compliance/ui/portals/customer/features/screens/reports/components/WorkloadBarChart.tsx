import type { WorkloadRow } from '../data/reportsMock';

export interface WorkloadBarChartProps {
  rows: WorkloadRow[];
}

export function WorkloadBarChart({ rows }: WorkloadBarChartProps) {
  const maxAssigned = Math.max(...rows.map((r) => r.totalAssigned));

  return (
    <div className="space-y-2 px-2">
      {rows.map((r) => {
        const completedW = (r.completed / maxAssigned) * 100;
        const inProgressW = (r.inProgress / maxAssigned) * 100;
        const overdueW = (r.overdue / maxAssigned) * 100;

        return (
          <div key={r.id} className="flex items-center gap-3">
            <div className="flex items-center gap-2 w-[100px] shrink-0">
              <span
                aria-hidden
                className="w-5 h-5 flex-none flex items-center justify-center text-[8px] font-sans font-semibold text-paper-raised"
                style={{ backgroundColor: r.color }}
              >
                {r.initials}
              </span>
              <span className="text-[11px] font-sans text-ink truncate">
                {r.name.split(' ')[0]}
              </span>
            </div>
            <div className="flex-1 flex h-4 bg-rule/30">
              <div className="h-full bg-filed" style={{ width: `${completedW}%` }} />
              <div className="h-full bg-authority" style={{ width: `${inProgressW}%` }} />
              {r.overdue > 0 && (
                <div className="h-full bg-signal" style={{ width: `${overdueW}%` }} />
              )}
            </div>
            <span className="text-[11px] font-mono tabular-nums text-ink-soft w-6 text-right">
              {r.totalAssigned}
            </span>
          </div>
        );
      })}
    </div>
  );
}
