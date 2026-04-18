import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';

export type AvatarBadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarBadgeShape = 'square' | 'circle';
export type AvatarBadgeTone = 'authority' | 'ink' | 'muted';

export interface AvatarBadgeProps {
  initials: string;
  size?: AvatarBadgeSize;
  shape?: AvatarBadgeShape;
  tone?: AvatarBadgeTone;
  /** Overrides `tone` when provided — any CSS color (hex, var, rgb). */
  color?: string;
  className?: string;
  title?: string;
}

const SIZE_STYLES: Record<AvatarBadgeSize, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-7 h-7 text-[10px]',
  lg: 'w-8 h-8 text-[10px]',
  xl: 'w-12 h-12 text-sm',
};

const TONE_STYLES: Record<AvatarBadgeTone, string> = {
  authority: 'bg-authority text-paper-raised',
  ink: 'bg-ink text-paper-raised',
  muted: 'bg-ink-muted text-paper-raised',
};

export function AvatarBadge({
  initials,
  size = 'sm',
  shape = 'square',
  tone = 'authority',
  color,
  className,
  title,
}: AvatarBadgeProps) {
  const style: CSSProperties | undefined = color
    ? { backgroundColor: color }
    : undefined;

  return (
    <span
      aria-hidden
      title={title}
      style={style}
      className={cn(
        'flex-none flex items-center justify-center font-sans font-semibold',
        SIZE_STYLES[size],
        shape === 'circle' && 'rounded-full',
        !color && TONE_STYLES[tone],
        color && 'text-paper-raised',
        className,
      )}
    >
      {initials}
    </span>
  );
}
