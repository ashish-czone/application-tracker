import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { SectionRule } from './SectionRule';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Small-caps eyebrow label. */
  eyebrow?: string;
  /** Serif italic pulled-quote headline — the whole point of this component. */
  quote: ReactNode;
  /** Small attribution line below the quote (optional). */
  attribution?: string;
  /** Single CTA — avoid more than one. */
  cta?: ReactNode;
}

/**
 * Editorial empty state. No illustration. No clipart. One serif italic
 * pulled-quote headline framed by section rules. Optional single CTA. The
 * message does the work — we trust users enough to talk to them like adults.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ eyebrow, quote, attribution, cta, className, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('w-full py-16 px-8 text-center', className)}
        {...rest}
      >
        {eyebrow && (
          <div className="mb-5">
            <SectionRule label={eyebrow} align="center" />
          </div>
        )}
        <blockquote className="font-serif italic text-ink text-2xl md:text-3xl leading-snug max-w-2xl mx-auto">
          <span className="text-ink-muted mr-1">“</span>
          {quote}
          <span className="text-ink-muted ml-1">”</span>
        </blockquote>
        {attribution && (
          <div className="mt-4 uppercase font-sans font-medium text-[11px] tracking-eyebrow text-ink-muted">
            — {attribution}
          </div>
        )}
        {cta && (
          <div className="mt-8 flex items-center justify-center">{cta}</div>
        )}
      </div>
    );
  },
);
EmptyState.displayName = 'EmptyState';
