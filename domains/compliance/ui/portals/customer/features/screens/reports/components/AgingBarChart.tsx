export interface AgingBucket {
  range: string;
  label: string;
  count: number;
  tone: 'due-soon' | 'signal';
}

export interface AgingBarChartProps {
  buckets: AgingBucket[];
}

export function AgingBarChart({ buckets }: AgingBarChartProps) {
  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="space-y-3 px-2">
      {buckets.map((b) => {
        const pct = (b.count / maxCount) * 100;
        const bg = b.tone === 'due-soon' ? 'bg-due-soon' : 'bg-signal';

        return (
          <div key={b.range} className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-ink-soft w-[72px] text-right shrink-0">
              {b.label}
            </span>
            <div className="flex-1 h-5 bg-rule/50">
              <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-mono tabular-nums text-ink font-medium w-6 text-right">
              {b.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
