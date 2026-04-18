import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  /** Optional leading roman-numeral / section mark (e.g. "§ II"). */
  mark?: string;
  /** Muted when used as metadata, strong when used as section eyebrow. */
  tone?: 'muted' | 'strong' | 'signal' | 'authority';
  /** `md` is the default 11px label; `sm` is a 10px micro-label. */
  size?: 'sm' | 'md';
}

const TONE_CLASSES: Record<NonNullable<EyebrowProps['tone']>, string> = {
  muted: 'text-ink-muted',
  strong: 'text-ink',
  signal: 'text-signal',
  authority: 'text-authority',
};

const SIZE_CLASSES: Record<NonNullable<EyebrowProps['size']>, string> = {
  md: 'text-[11px] tracking-eyebrow',
  sm: 'text-[10px] tracking-eyebrow',
};

/**
 * Small-caps uppercase label. The utility eyebrow used everywhere in the
 * Instrument theme — above titles, as cell headers, as metadata labels.
 */
export const Eyebrow = forwardRef<HTMLSpanElement, EyebrowProps>(
  ({ mark, tone = 'muted', size = 'md', className, children, ...rest }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-baseline gap-1.5 uppercase font-sans font-medium',
          SIZE_CLASSES[size],
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
