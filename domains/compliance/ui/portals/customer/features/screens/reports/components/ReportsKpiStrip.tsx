import { TrendingUp } from 'lucide-react';

export interface ReportsKpiStripProps {
  totalFilings: number;
  avgOnTimeRate: number;
  totalOverdue: number;
  clientsTracked: number;
}

export function ReportsKpiStrip({
  totalFilings,
  avgOnTimeRate,
  totalOverdue,
  clientsTracked,
}: ReportsKpiStripProps) {
  return (
    <section className="grid grid-cols-4 gap-px bg-rule border border-rule mb-8">
      <div className="bg-paper-raised px-5 py-4">
        <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
          Total filings
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl tabular-nums text-ink">{totalFilings}</span>
          <span className="font-serif italic text-[11px] text-ink-muted">in period</span>
        </div>
      </div>
      <div className="bg-paper-raised px-5 py-4">
        <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
          On-time rate
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl tabular-nums text-filed">{avgOnTimeRate}%</span>
          <span className="flex items-center gap-0.5 text-[11px] font-sans text-filed">
            <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
            +2.1%
          </span>
        </div>
      </div>
      <div className="bg-paper-raised px-5 py-4">
        <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
          Currently overdue
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl tabular-nums text-signal">{totalOverdue}</span>
          <span className="font-serif italic text-[11px] text-ink-muted">filings</span>
        </div>
      </div>
      <div className="bg-paper-raised px-5 py-4">
        <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
          Clients tracked
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl tabular-nums text-ink">{clientsTracked}</span>
          <span className="font-serif italic text-[11px] text-ink-muted">entities</span>
        </div>
      </div>
    </section>
  );
}
