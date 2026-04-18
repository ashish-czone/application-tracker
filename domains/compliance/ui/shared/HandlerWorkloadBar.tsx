import { type HTMLAttributes } from 'react';
import { AvatarBadge, Eyebrow } from '@packages/ui';
import type { Handler } from './types';

export interface HandlerWorkload {
  handler: Handler;
  overdue: number;
  dueThisWeek: number;
  upcoming: number;
  /** Max workload across all handlers — used to normalize the bar. */
  capacity?: number;
}

export interface HandlerWorkloadBarProps extends HTMLAttributes<HTMLDivElement> {
  workload: HandlerWorkload;
  /** Shared scale max across all handlers, for visual comparability. */
  scaleMax: number;
}

/**
 * A single handler's workload rendered as a segmented horizontal bar.
 * Overdue = signal orange, due-this-week = gold, upcoming = ink-soft.
 * Total count on the right in mono. Used stacked in the dashboard sidebar.
 */
export function HandlerWorkloadBar({
  workload,
  scaleMax,
  className = '',
  ...rest
}: HandlerWorkloadBarProps) {
  const { handler, overdue, dueThisWeek, upcoming } = workload;
  const total = overdue + dueThisWeek + upcoming;
  const denom = Math.max(scaleMax, 1);
  const overduePct = (overdue / denom) * 100;
  const duePct = (dueThisWeek / denom) * 100;
  const upcomingPct = (upcoming / denom) * 100;

  return (
    <div className={`py-3 ${className}`} {...rest}>
      <div className="flex items-center gap-3 mb-1.5">
        <AvatarBadge initials={handler.initials} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-ink font-sans truncate">{handler.name}</div>
          {handler.role && (
            <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
              {handler.role}
            </div>
          )}
        </div>
        <span className="font-mono tabular-nums text-base text-ink leading-none">{total}</span>
      </div>
      <div className="relative h-[6px] bg-paper-sunken/80 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-signal" style={{ width: `${overduePct}%` }} />
        <div
          className="absolute inset-y-0 bg-due-soon"
          style={{ left: `${overduePct}%`, width: `${duePct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-ink-soft/60"
          style={{ left: `${overduePct + duePct}%`, width: `${upcomingPct}%` }}
        />
      </div>
      {overdue > 0 && (
        <div className="mt-1 flex items-center gap-3 text-[10px] font-sans">
          <span className="text-signal">
            <span className="font-mono tabular-nums">{overdue}</span> overdue
          </span>
          {dueThisWeek > 0 && (
            <span className="text-due-soon">
              <span className="font-mono tabular-nums">{dueThisWeek}</span> due
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export interface HandlerWorkloadListProps extends HTMLAttributes<HTMLDivElement> {
  workloads: HandlerWorkload[];
}

/**
 * Stacked list of HandlerWorkloadBar. Calculates scale max once so all bars
 * share the same horizontal scale.
 */
export function HandlerWorkloadList({
  workloads,
  className = '',
  ...rest
}: HandlerWorkloadListProps) {
  const scaleMax = Math.max(
    ...workloads.map((w) => w.overdue + w.dueThisWeek + w.upcoming),
    1,
  );
  return (
    <div className={`bg-paper-raised border border-rule ${className}`} {...rest}>
      <div className="px-5 py-3 border-b border-rule">
        <Eyebrow tone="muted">Handler Workload</Eyebrow>
        <h3 className="font-serif text-xl text-ink leading-none mt-0.5">
          This month
        </h3>
      </div>
      <div className="px-5 divide-y divide-rule/60">
        {workloads.map((w) => (
          <HandlerWorkloadBar key={w.handler.id} workload={w} scaleMax={scaleMax} />
        ))}
      </div>
    </div>
  );
}
