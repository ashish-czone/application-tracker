import type { ReactNode } from 'react';

export interface PillProps {
  /**
   * Tailwind background utility for the status dot (e.g. `bg-signal`).
   * Omit to render a dotless label pill (Frequency, plain status).
   */
  tone?: string;
  children: ReactNode;
}

/**
 * Shared chrome for compliance eyebrow pills — hairline border, tiny caps.
 * Specialized pills (Risk, Priority, Status, Frequency, FilingStatus) build
 * on this with their own LABEL/TONE maps.
 */
export function Pill({ tone, children }: PillProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised">
      {tone && <span className={`w-1.5 h-1.5 flex-none ${tone}`} aria-hidden />}
      <span className="text-ink-soft">{children}</span>
    </span>
  );
}
