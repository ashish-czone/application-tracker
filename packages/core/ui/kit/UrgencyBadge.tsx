import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export type Urgency =
  | 'overdue'
  | 'due-today'
  | 'due-this-week'
  | 'upcoming'
  | 'filed'
  | 'draft';

export interface UrgencyBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  urgency: Urgency;
  /** Optional trailing number — e.g. "Overdue · 3 d". */
  tail?: string;
  /** Variant — "solid" (strong fill) or "rule" (outline only, default). */
  variant?: 'solid' | 'rule';
}

const LABEL: Record<Urgency, string> = {
  overdue: 'Overdue',
  'due-today': 'Due Today',
  'due-this-week': 'Due This Week',
  upcoming: 'Upcoming',
  filed: 'Filed',
  draft: 'Draft',
};

const RULE_STYLE: Record<Urgency, string> = {
  overdue: 'border-signal/70 text-signal bg-signal-soft/40',
  'due-today': 'border-signal/70 text-signal bg-paper-raised',
  'due-this-week': 'border-due-soon/70 text-due-soon bg-due-soon-soft/50',
  upcoming: 'border-ink-muted/40 text-ink-soft bg-paper-raised',
  filed: 'border-filed/60 text-filed bg-filed-soft/60',
  draft: 'border-ink-muted/30 text-ink-muted bg-paper-sunken/70',
};

const SOLID_STYLE: Record<Urgency, string> = {
  overdue: 'bg-signal text-paper-raised border-signal',
  'due-today': 'bg-signal text-paper-raised border-signal',
  'due-this-week': 'bg-due-soon text-paper-raised border-due-soon',
  upcoming: 'bg-ink-soft text-paper-raised border-ink-soft',
  filed: 'bg-filed text-paper-raised border-filed',
  draft: 'bg-ink-muted text-paper-raised border-ink-muted',
};

/**
 * Small-caps urgency chip with a tiny leading mark and optional trailing
 * monospace tail. Color is purposeful — signal orange is reserved for
 * overdue / due-today only; nothing else uses it. That's the point.
 */
export const UrgencyBadge = forwardRef<HTMLSpanElement, UrgencyBadgeProps>(
  ({ urgency, tail, variant = 'rule', className, ...rest }, ref) => {
    const mark = urgency === 'overdue' || urgency === 'due-today' ? '●' : urgency === 'filed' ? '✓' : '·';
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-[3px]',
          'text-[10px] font-sans font-semibold uppercase tracking-[0.14em]',
          'border',
          variant === 'solid' ? SOLID_STYLE[urgency] : RULE_STYLE[urgency],
          className,
        )}
        {...rest}
      >
        <span aria-hidden className="text-[10px] leading-none">
          {mark}
        </span>
        <span>{LABEL[urgency]}</span>
        {tail && (
          <>
            <span aria-hidden className="opacity-50">·</span>
            <span className="font-mono tabular-nums tracking-normal normal-case font-medium">{tail}</span>
          </>
        )}
      </span>
    );
  },
);
UrgencyBadge.displayName = 'UrgencyBadge';
