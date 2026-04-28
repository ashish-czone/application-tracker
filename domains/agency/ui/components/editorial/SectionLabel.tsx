import type { ReactNode } from 'react';

export interface SectionLabelProps {
  /** Two-digit section number, e.g. "01". Rendered with the rust accent. */
  number: string;
  /** All-caps label, e.g. "WORK", "APPROACH". */
  label: ReactNode;
  /** Optional trailing kicker, e.g. "(2024)" or location. */
  meta?: ReactNode;
  className?: string;
}

/**
 * Editorial section header — a numbered label with optional metadata,
 * sitting above the main heading of every major section. Borrows the
 * "01 / SERVICES" pattern from contemporary agency sites where each
 * section reads as a discrete chapter.
 */
export function SectionLabel({ number, label, meta, className }: SectionLabelProps) {
  return (
    <div
      className={
        'flex items-baseline gap-3 text-xs font-semibold tracking-[0.22em] uppercase ' +
        (className ?? '')
      }
    >
      <span className="text-[hsl(var(--accent))]">{number}</span>
      <span className="h-px w-8 bg-[hsl(var(--hairline))] self-center" aria-hidden />
      <span className="text-[hsl(var(--foreground))]">{label}</span>
      {meta && (
        <>
          <span className="text-[hsl(var(--muted-foreground))]" aria-hidden>
            ·
          </span>
          <span className="text-[hsl(var(--muted-foreground))] tracking-[0.18em]">{meta}</span>
        </>
      )}
    </div>
  );
}
