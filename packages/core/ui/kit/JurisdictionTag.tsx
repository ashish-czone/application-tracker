import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export type Jurisdiction = 'central' | 'state' | 'municipal' | 'international';

export interface JurisdictionTagProps extends HTMLAttributes<HTMLSpanElement> {
  jurisdiction: Jurisdiction;
  /** Optional locality (state name, city). Rendered italicized after the tag. */
  locality?: string;
}

const LABEL: Record<Jurisdiction, string> = {
  central: 'Central',
  state: 'State',
  municipal: 'Municipal',
  international: 'International',
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
  ({ jurisdiction, locality, className, ...rest }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-[1px] border',
          'text-[9px] font-sans font-semibold uppercase tracking-[0.18em] bg-paper-raised',
          COLOR[jurisdiction],
          className,
        )}
        {...rest}
      >
        <span>{LABEL[jurisdiction]}</span>
        {locality && (
          <span className="font-serif italic font-normal normal-case tracking-normal text-[11px] text-ink-soft ml-0.5">
            {locality}
          </span>
        )}
      </span>
    );
  },
);
JurisdictionTag.displayName = 'JurisdictionTag';
