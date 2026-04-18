import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@packages/ui';

export type ColoredInitialsAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const SIZE_CLASSES: Record<ColoredInitialsAvatarSize, string> = {
  xs: 'w-5 h-5 text-[8px]',
  sm: 'w-6 h-6 text-[9px]',
  md: 'w-7 h-7 text-[9px]',
  lg: 'w-8 h-8 text-[10px]',
  xl: 'w-9 h-9 text-[11px]',
  '2xl': 'w-14 h-14 text-lg',
  '3xl': 'w-16 h-16 text-lg',
};

export interface ColoredInitialsAvatarProps extends HTMLAttributes<HTMLSpanElement> {
  initials: string;
  /** Tailwind-safe color literal (e.g. hex from seed data). Falls back to `hsl(var(--authority))`. */
  color?: string;
  size?: ColoredInitialsAvatarSize;
  /** Subtle rounding. Default: square. */
  rounded?: boolean;
}

/**
 * Brand-colored initials tile — the canonical compliance "entity marker".
 * Used everywhere we need a client/user glance-identity chip: rows, header
 * panels, popovers, bar charts.
 */
export const ColoredInitialsAvatar = forwardRef<HTMLSpanElement, ColoredInitialsAvatarProps>(
  ({ initials, color, size = 'lg', rounded, className, style, ...rest }, ref) => {
    return (
      <span
        ref={ref}
        aria-hidden
        className={cn(
          'flex-none flex items-center justify-center font-sans font-semibold text-paper-raised',
          SIZE_CLASSES[size],
          rounded && 'rounded-sm',
          className,
        )}
        style={{ backgroundColor: color ?? 'hsl(var(--authority))', ...style }}
        {...rest}
      >
        {initials}
      </span>
    );
  },
);
ColoredInitialsAvatar.displayName = 'ColoredInitialsAvatar';
