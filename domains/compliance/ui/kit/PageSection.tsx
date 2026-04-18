import type { ReactNode } from 'react';
import { SectionRule, cn } from '@packages/ui';

export interface PageSectionProps {
  /** Section marker label — e.g. "§ II — The Next Fortnight". */
  mark: string;
  /** Optional italic serif intro paragraph shown under the section rule. */
  intro?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Top-level page section: `<SectionRule>` + optional intro paragraph + body.
 * Default top margin is `mt-16`; override via `className`.
 */
export function PageSection({
  mark,
  intro,
  className,
  bodyClassName,
  children,
}: PageSectionProps) {
  return (
    <section className={cn('mt-16', className)}>
      <SectionRule label={mark} align="left" />
      {intro ? (
        <p className="mt-3 max-w-[62ch] text-sm text-ink-soft font-serif italic leading-relaxed">
          {intro}
        </p>
      ) : null}
      <div className={cn(intro ? 'mt-6' : 'mt-4', bodyClassName)}>{children}</div>
    </section>
  );
}
