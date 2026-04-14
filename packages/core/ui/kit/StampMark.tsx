import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export type StampKind = 'filed' | 'overdue' | 'draft' | 'void' | 'confidential' | 'review';

export interface StampMarkProps extends HTMLAttributes<HTMLDivElement> {
  kind: StampKind;
  /** Optional secondary line (date, user). */
  sub?: string;
  /** "sm" (pill, inline), "md" (card overlay), "lg" (hero page stamp). */
  size?: 'sm' | 'md' | 'lg';
  /** Rotation in degrees. Default: -2. */
  angle?: number;
}

const KIND_COLOR: Record<StampKind, string> = {
  filed: 'text-filed border-filed/80',
  overdue: 'text-signal border-signal/80',
  draft: 'text-ink-muted border-ink-muted/80',
  void: 'text-ink-muted border-ink-muted/60',
  confidential: 'text-authority border-authority/80',
  review: 'text-due-soon border-due-soon/80',
};

const SIZE: Record<NonNullable<StampMarkProps['size']>, string> = {
  sm: 'px-2 py-[2px] text-[10px] border-[1.5px] tracking-[0.2em]',
  md: 'px-3 py-1 text-xs border-2 tracking-[0.22em]',
  lg: 'px-5 py-2 text-base border-[3px] tracking-[0.24em]',
};

/**
 * Decorative angled stamp mark — used to show state changes on rows and cards.
 * Refers to the physical stamps on old legal paperwork without caricaturing it:
 * a crisp double outline, subtle rotation, small-caps text, one of the theme's
 * semantic colors. No distress textures, no noise — restraint is the point.
 */
export const StampMark = forwardRef<HTMLDivElement, StampMarkProps>(
  ({ kind, sub, size = 'md', angle = -2, className, style, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex flex-col items-center justify-center',
          'font-sans font-bold uppercase select-none',
          'bg-paper-raised/60 backdrop-blur-[0.5px]',
          'relative stamp-in',
          KIND_COLOR[kind],
          SIZE[size],
          className,
        )}
        style={{ transform: `rotate(${angle}deg)`, ...style }}
        {...rest}
      >
        {/* Inner second rule for double-border effect */}
        <span
          aria-hidden
          className={cn(
            'absolute inset-[3px] border border-current opacity-60 pointer-events-none',
          )}
        />
        <span className="relative leading-none">{kind === 'filed' ? 'Filed' : kind}</span>
        {sub && (
          <span className="relative mt-[3px] text-[0.6em] font-mono font-normal tracking-[0.1em] opacity-80 normal-case">
            {sub}
          </span>
        )}
      </div>
    );
  },
);
StampMark.displayName = 'StampMark';
