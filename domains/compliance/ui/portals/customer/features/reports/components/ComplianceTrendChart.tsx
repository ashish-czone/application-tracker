export interface ComplianceTrendDatum {
  month: string;
  onTime: number;
  late: number;
  overdue: number;
}

export interface ComplianceTrendChartProps {
  data: ComplianceTrendDatum[];
}

export function ComplianceTrendChart({ data }: ComplianceTrendChartProps) {
  const maxVal = Math.max(...data.map((d) => d.onTime + d.late + d.overdue));
  const barH = 140;

  return (
    <div className="flex items-end justify-center gap-6 h-[180px] px-2">
      {data.map((d) => {
        const total = d.onTime + d.late + d.overdue;
        const scale = total / maxVal;
        const onTimeH = (d.onTime / total) * barH * scale;
        const lateH = (d.late / total) * barH * scale;
        const overdueH = (d.overdue / total) * barH * scale;

        return (
          <div key={d.month} className="flex flex-col items-center gap-1">
            <div className="w-10 flex flex-col justify-end" style={{ height: barH }}>
              <div className="w-full bg-signal" style={{ height: overdueH }} />
              <div className="w-full bg-due-soon" style={{ height: lateH }} />
              <div className="w-full bg-filed" style={{ height: onTimeH }} />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wide text-ink-muted text-center">
              {d.month}
            </span>
            <span className="text-[10px] font-mono tabular-nums text-ink-soft text-center">
              {total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
