import { AlertTriangle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { OrdinalDate } from '../editorial/OrdinalDate';

export type InactiveKind = 'dormant' | 'deactivated' | 'deprecated';

export interface InactiveStateBannerProps {
  kind: InactiveKind;
  /** ISO date the entity entered the inactive state — when known, rendered after the label. */
  effectiveAt?: string | null;
  /** Optional human-readable rationale (e.g. dormancy reason). */
  reason?: string | null;
  /** Override the default heading copy. */
  title?: ReactNode;
  /** Optional trailing slot for actions (e.g. "View audit"). */
  action?: ReactNode;
  /** Override the default icon. */
  icon?: LucideIcon;
  className?: string;
}

const KIND_COPY: Record<InactiveKind, { title: string; bodyVerb: string }> = {
  dormant: {
    title: 'Client is dormant',
    bodyVerb: 'Marked dormant',
  },
  deactivated: {
    title: 'Registration deactivated',
    bodyVerb: 'Deactivated',
  },
  deprecated: {
    title: 'Rule deprecated',
    bodyVerb: 'Deprecated',
  },
};

/**
 * Banner rendered on client / registration / rule detail surfaces when the
 * entity is in a terminal-ish inactive state (dormant client, deactivated
 * registration, deprecated rule). Sits below the header so it can't be
 * missed but doesn't overpower the page chrome.
 */
export function InactiveStateBanner({
  kind,
  effectiveAt,
  reason,
  title,
  action,
  icon: Icon = AlertTriangle,
  className,
}: InactiveStateBannerProps) {
  const copy = KIND_COPY[kind];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 border border-rule bg-paper-raised px-4 py-3 mb-6 ${className ?? ''}`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink">
          {title ?? copy.title}
        </p>
        <p className="text-[11px] font-sans text-ink-soft mt-0.5">
          {copy.bodyVerb}
          {effectiveAt ? (
            <>
              {' on '}
              <OrdinalDate date={effectiveAt} variant="short" className="inline text-[11px]" />
            </>
          ) : null}
          {reason ? <> — {reason}</> : null}
          .
        </p>
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}
