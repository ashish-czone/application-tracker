import { type HTMLAttributes } from 'react';
import {
  DueDateBlock,
  Eyebrow,
  JurisdictionTag,
  StampMark,
  UrgencyBadge,
} from '@packages/ui';
import type { Filing } from './types';

export interface FilingTaskCardProps extends HTMLAttributes<HTMLDivElement> {
  filing: Filing;
  /** Compact variant for list cells — no big date block, no handler row. */
  variant?: 'full' | 'brief';
  /** Optional action rendered in the footer (e.g. "Mark Filed" button). */
  action?: React.ReactNode;
  /** Reference "today" for countdown math. */
  today?: Date;
}

/**
 * The filing task card — one of the most-used widgets in the product. Shows
 * who owes what to whom by when. Full variant has a hero DueDateBlock on the
 * left; brief variant is a compact row for sidebars and lists. Rows in the
 * FILED state get a StampMark overlay.
 */
export function FilingTaskCard({
  filing,
  variant = 'full',
  action,
  today,
  className = '',
  ...rest
}: FilingTaskCardProps) {
  const isFiled = filing.status === 'filed';

  if (variant === 'brief') {
    return (
      <div
        className={`relative bg-paper-raised border border-rule px-4 py-3 ${className}`}
        {...rest}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-mono text-[10px] text-ink-muted tracking-tabular uppercase">
                {filing.lawCode}
              </span>
              <span className="text-ink-muted text-[10px]">·</span>
              <span className="font-serif italic text-[11px] text-ink-soft truncate">
                {filing.periodLabel}
              </span>
            </div>
            <div className="text-sm text-ink font-sans truncate">{filing.clientName}</div>
            <div className="text-[11px] text-ink-muted font-sans truncate">{filing.ruleName}</div>
          </div>
          <DueDateBlock date={filing.dueDate} referenceDate={today} compact className="text-right" />
        </div>
        {isFiled && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <StampMark kind="filed" size="sm" sub={filing.periodLabel} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative bg-paper-raised border border-rule ${className}`}
      {...rest}
    >
      <div className="grid grid-cols-[auto_1fr] gap-6 p-6 pb-5">
        <DueDateBlock date={filing.dueDate} referenceDate={today} />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[11px] text-ink-muted tracking-tabular uppercase">
              {filing.lawCode}
            </span>
            <span className="text-ink-muted">·</span>
            <JurisdictionTag jurisdiction={filing.jurisdiction} />
            <span className="ml-auto">
              <UrgencyBadge urgency={filing.status} />
            </span>
          </div>
          <h4 className="font-serif text-xl text-ink leading-tight mb-1 truncate">
            {filing.ruleName}
          </h4>
          <p className="font-serif italic text-sm text-ink-soft mb-3">
            for{' '}
            <span className="not-italic font-sans font-medium text-ink">{filing.clientName}</span>
          </p>
          <div className="flex items-center gap-4 mt-auto pt-3 border-t border-rule/70">
            <div>
              <Eyebrow tone="muted">Period</Eyebrow>
              <div className="text-sm text-ink font-mono tabular-nums mt-0.5">
                {filing.periodLabel}
              </div>
            </div>
            {filing.handler && (
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="w-7 h-7 rounded-full bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
                >
                  {filing.handler.initials}
                </span>
                <div>
                  <Eyebrow tone="muted">Handler</Eyebrow>
                  <div className="text-sm text-ink font-sans mt-0.5">{filing.handler.name}</div>
                </div>
              </div>
            )}
            {action && <div className="ml-auto">{action}</div>}
          </div>
        </div>
      </div>
      {isFiled && (
        <div className="absolute top-5 right-5 pointer-events-none">
          <StampMark kind="filed" size="md" sub={filing.periodLabel} />
        </div>
      )}
    </div>
  );
}
