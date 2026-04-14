import { type HTMLAttributes } from 'react';
import { Eyebrow, JurisdictionTag, OrdinalDate } from '@packages/ui';
import type { Law } from './types';

export interface LawCardProps extends HTMLAttributes<HTMLDivElement> {
  law: Law;
  ruleCount?: number;
  handlerCount?: number;
  clientCount?: number;
  /** Child count, rules under this law — shown as a small footnote. */
  description?: string;
}

/**
 * Editorial card for one law — big serif name, mono code, jurisdiction tag,
 * authority and effective date on one line, counts on another. No shadows,
 * just a hairline box and the paper-raised surface.
 */
export function LawCard({
  law,
  ruleCount,
  handlerCount,
  clientCount,
  description,
  className = '',
  ...rest
}: LawCardProps) {
  return (
    <div
      className={`relative bg-paper-raised border border-rule p-6 ${className}`}
      {...rest}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[11px] font-medium text-ink-muted tracking-tabular uppercase">
              {law.code}
            </span>
            <span className="text-ink-muted">·</span>
            <JurisdictionTag jurisdiction={law.jurisdiction} locality={law.locality} />
          </div>
          <h3 className="font-serif text-3xl text-ink leading-tight tracking-[-0.01em] mb-1">
            {law.name}
          </h3>
          <p className="font-serif italic text-ink-soft text-sm">
            Issued by{' '}
            <span className="not-italic font-sans text-ink">{law.issuingAuthority}</span>
          </p>
        </div>
        {law.effectiveFrom && (
          <div className="text-right">
            <Eyebrow tone="muted" className="mb-1 justify-end flex">
              Effective
            </Eyebrow>
            <OrdinalDate date={law.effectiveFrom} variant="short" className="text-sm" />
          </div>
        )}
      </div>

      {description && (
        <p className="mt-4 text-sm text-ink-soft font-sans leading-relaxed max-w-2xl">
          {description}
        </p>
      )}

      <div className="mt-6 pt-4 border-t border-rule grid grid-cols-3 gap-4">
        {[
          { label: 'Rules', value: ruleCount ?? 0 },
          { label: 'Handlers', value: handlerCount ?? 0 },
          { label: 'Clients', value: clientCount ?? 0 },
        ].map((stat) => (
          <div key={stat.label}>
            <Eyebrow tone="muted">{stat.label}</Eyebrow>
            <div className="mt-1 font-mono tabular-nums text-2xl text-ink font-medium">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
