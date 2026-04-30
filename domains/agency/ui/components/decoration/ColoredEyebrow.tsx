import type { ReactNode } from 'react';

export interface ColoredEyebrowProps {
  children: ReactNode;
  /** Tone for the bullet. Defaults to the active skin anchor. */
  tone?: string;
  className?: string;
}

/**
 * Replaces the bracketed mono `[ Practices ]` eyebrow with a small
 * colored bullet + label. Works in any skin — without an explicit tone
 * the bullet picks up the skin's anchor color.
 */
export function ColoredEyebrow({ children, tone, className }: ColoredEyebrowProps) {
  return (
    <span
      className={
        'inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-700 ' +
        (className ?? '')
      }
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: tone ?? 'hsl(var(--skin-anchor))' }}
      />
      {children}
    </span>
  );
}
