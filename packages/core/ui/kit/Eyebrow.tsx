import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  /** Optional leading roman-numeral / section mark (e.g. "§ II"). */
  mark?: string;
  /** Muted when used as metadata, strong when used as section eyebrow. */
  tone?: 'muted' | 'strong' | 'signal' | 'authority';
}

const TONE_CLASSES: Record<NonNullable<EyebrowProps['tone']>, string> = {
  muted: 'text-ink-muted',
  strong: 'text-ink',
  signal: 'text-signal',
  authority: 'text-authority',
};

/**
 * Small-caps uppercase label. The utility eyebrow used everywhere in the
 * Instrument theme — above titles, as cell headers, as metadata labels.
 */
export const Eyebrow = forwardRef<HTMLSpanElement, EyebrowProps>(
  ({ mark, tone = 'muted', className, children, ...rest }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-baseline gap-1.5 uppercase font-sans font-medium',
          'text-[11px] tracking-eyebrow',
          TONE_CLASSES[tone],
          className,
        )}
        {...rest}
      >
        {mark && (
          <span className="font-serif italic normal-case tracking-normal text-[12px] leading-none">
            {mark}
          </span>
        )}
        {children}
      </span>
    );
  },
);
Eyebrow.displayName = 'Eyebrow';
