import { Archive } from 'lucide-react';
import type { InactiveKind } from './InactiveStateBanner';

export interface InactiveSourceMarkerProps {
  kind: InactiveKind;
  className?: string;
}

const LABEL: Record<InactiveKind, string> = {
  dormant: 'Dormant',
  deactivated: 'Deactivated',
  deprecated: 'Deprecated',
};

/**
 * Subtle inline marker shown on table rows / drawer headers whose source
 * (client, registration, or rule) is inactive — so a user looking at the
 * filing queue understands why an unfamiliar row is there. Uses muted ink
 * so it never competes with the row's primary status badge.
 */
export function InactiveSourceMarker({ kind, className }: InactiveSourceMarkerProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-[1px] border border-rule text-[10px] font-sans uppercase tracking-[0.1em] text-ink-muted bg-paper ${className ?? ''}`}
      title={`Source ${LABEL[kind].toLowerCase()}`}
    >
      <Archive className="w-2.5 h-2.5" strokeWidth={1.5} />
      {LABEL[kind]}
    </span>
  );
}
