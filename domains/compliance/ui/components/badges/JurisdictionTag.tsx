import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@packages/ui';

export type Jurisdiction = 'central' | 'state' | 'municipal' | 'international';

export type JurisdictionTagVariant = 'default' | 'muted';

export interface JurisdictionTagProps extends HTMLAttributes<HTMLSpanElement> {
  jurisdiction: Jurisdiction;
  /** Optional locality (state name, city). Only rendered on the default variant. */
  locality?: string;
  /**
   * `default` — colored by jurisdiction axis, for standalone pills.
   * `muted`   — grayscale + abbreviated international, for dense table cells
   *             where the tag sits next to other information.
   */
  variant?: JurisdictionTagVariant;
}

const LABEL: Record<Jurisdiction, string> = {
  central: 'Central',
  state: 'State',
  municipal: 'Municipal',
  international: 'International',
};

const SHORT_LABEL: Record<Jurisdiction, string> = {
  central: 'Central',
  state: 'State',
  municipal: 'Municipal',
  international: "Int'l",
};

const COLOR: Record<Jurisdiction, string> = {
  central: 'text-authority border-authority/60',
  state: 'text-due-soon border-due-soon/60',
  municipal: 'text-ink-soft border-ink-soft/40',
  international: 'text-filed border-filed/60',
};

/**
 * Jurisdiction pill — tiny caps, hairline border. Central/State/Municipal/
 * International are the core axes for compliance law scope.
 */
export const JurisdictionTag = forwardRef<HTMLSpanElement, JurisdictionTagProps>(
  ({ jurisdiction, locality, variant = 'default', className, ...rest }, ref) => {
    const isMuted = variant === 'muted';
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-[1px] border',
          'font-sans font-semibold uppercase bg-paper-raised',
          isMuted
            ? 'text-[9px] tracking-[0.14em] text-ink-muted border-rule'
            : cn('text-[9px] tracking-[0.18em]', COLOR[jurisdiction]),
          className,
        )}
        {...rest}
      >
        <span>{(isMuted ? SHORT_LABEL : LABEL)[jurisdiction]}</span>
        {!isMuted && locality && (
          <span className="font-serif italic font-normal normal-case tracking-normal text-[11px] text-ink-soft ml-0.5">
            {locality}
          </span>
        )}
      </span>
    );
  },
);
JurisdictionTag.displayName = 'JurisdictionTag';
