import type { ReactNode } from 'react';

export interface MarqueeProps {
  /**
   * Items to scroll. Each will be repeated to fill the marquee. Strings
   * are rendered as text spans; ReactNodes are rendered as-is.
   */
  items: Array<string | ReactNode>;
  /** Animation duration in seconds for one full scroll cycle. */
  durationSec?: number;
  /** Direction. Defaults to left (text scrolls right→left). */
  direction?: 'left' | 'right';
  /** Background tone. */
  tone?: 'default' | 'inverse' | 'accent';
  /** Type scale for the items. */
  size?: 'sm' | 'lg' | 'xl';
  /** Separator glyph between items. */
  separator?: string;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<MarqueeProps['tone']>, string> = {
  default: 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border-y border-[hsl(var(--hairline))]',
  inverse:
    'bg-[hsl(var(--surface-inverse))] text-[hsl(var(--surface-inverse-foreground))]',
  accent: 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]',
};

const SIZE_CLASS: Record<NonNullable<MarqueeProps['size']>, string> = {
  sm: 'text-sm py-3 tracking-[0.16em]',
  lg: 'text-2xl md:text-3xl py-5 tracking-[-0.01em]',
  xl: 'text-4xl md:text-6xl py-8 tracking-[-0.02em] font-[var(--font-display)] font-semibold',
};

/**
 * CSS-only continuously scrolling horizontal marquee. Two side-by-side
 * tracks each contain the full item list; one is hidden from a11y.
 * No JS needed — animation runs even before hydration. Falls back to
 * a still strip when prefers-reduced-motion is set.
 */
export function Marquee({
  items,
  durationSec = 28,
  direction = 'left',
  tone = 'default',
  size = 'lg',
  separator = '·',
  className,
}: MarqueeProps) {
  const animationName = direction === 'left' ? 'agency-marquee-left' : 'agency-marquee-right';
  const renderTrack = (key: string, ariaHidden: boolean) => (
    <div
      key={key}
      aria-hidden={ariaHidden || undefined}
      className="shrink-0 flex items-center gap-12 px-6"
      style={{
        animation: `${animationName} ${durationSec}s linear infinite`,
        willChange: 'transform',
      }}
    >
      {items.map((item, i) => (
        <span key={i} className="shrink-0 inline-flex items-center gap-12 uppercase">
          {typeof item === 'string' ? <span>{item}</span> : item}
          <span aria-hidden className="opacity-50">
            {separator}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={
        'w-full overflow-hidden ' +
        TONE_CLASS[tone] +
        ' ' +
        SIZE_CLASS[size] +
        ' ' +
        (className ?? '')
      }
    >
      <div className="flex w-max">
        {renderTrack('a', false)}
        {renderTrack('b', true)}
      </div>
    </div>
  );
}
