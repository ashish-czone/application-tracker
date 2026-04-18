import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn, Eyebrow } from '@packages/ui';
import { OrdinalDate } from './OrdinalDate';

export interface PageMastheadProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Section mark like "§ I" or "Ch. 3". Rendered as italic serif mark in the eyebrow. */
  sectionMark?: string;
  /** Small-caps eyebrow text above the title. */
  eyebrow?: string;
  /** The page title — rendered in Instrument Serif display. */
  title: ReactNode;
  /** Optional serif italic subtitle. */
  subtitle?: ReactNode;
  /** Optional right-rail content (actions, user identity, filter chips). */
  right?: ReactNode;
  /** Optional date rendered under the title — defaults to today if `showDate` is true. */
  date?: Date | string;
  showDate?: boolean;
  /** Tighter variant for drawer or sub-page headers. */
  compact?: boolean;
}

/**
 * Newspaper-style page header. Eyebrow + roman-numeral section mark on top,
 * serif display title in the middle, optional date and right-rail on the sides.
 * A double hairline rule closes the masthead and separates it from the page body.
 */
export const PageMasthead = forwardRef<HTMLElement, PageMastheadProps>(
  (
    {
      sectionMark,
      eyebrow,
      title,
      subtitle,
      right,
      date,
      showDate,
      compact = false,
      className,
      ...rest
    },
    ref,
  ) => {
    const resolvedDate = date ?? (showDate ? new Date() : undefined);
    return (
      <header
        ref={ref}
        className={cn(
          'relative w-full',
          compact ? 'pt-4 pb-3' : 'pt-10 pb-6',
          className,
        )}
        {...rest}
      >
        <div className="flex items-start justify-between gap-8">
          <div className="flex-1 min-w-0">
            {(eyebrow || sectionMark) && (
              <Eyebrow mark={sectionMark} tone="muted" className="mb-3">
                {eyebrow}
              </Eyebrow>
            )}
            <h1
              className={cn(
                'font-serif text-ink leading-[0.95] tracking-[-0.01em]',
                compact ? 'text-3xl' : 'text-5xl md:text-6xl',
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className={cn(
                  'font-serif italic text-ink-soft mt-3 max-w-2xl',
                  compact ? 'text-base' : 'text-lg md:text-xl',
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
          {(right || resolvedDate) && (
            <div className="flex flex-col items-end gap-2 pt-1 text-right">
              {resolvedDate && (
                <div className="text-sm text-ink-soft">
                  <Eyebrow tone="muted" className="mb-1 justify-end flex">
                    Today
                  </Eyebrow>
                  <OrdinalDate date={resolvedDate} />
                </div>
              )}
              {right}
            </div>
          )}
        </div>
        {/* Double hairline rule closing the masthead */}
        <div className="mt-6 border-t border-rule" />
        <div className="mt-[3px] border-t border-rule/60" />
      </header>
    );
  },
);
PageMasthead.displayName = 'PageMasthead';
