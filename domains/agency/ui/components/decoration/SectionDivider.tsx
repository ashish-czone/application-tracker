interface SectionDividerProps {
  /** Fill color for the divider — defaults to the next-section background. */
  fill?: string;
  /** Flip vertically — useful when the divider sits at the top of a section. */
  flip?: boolean;
  className?: string;
}

/**
 * Soft curved SVG divider for transitioning between section
 * backgrounds. Sit it at the bottom of one tinted section, with `fill`
 * set to the *next* section's background — the curve bleeds into it.
 */
export function SectionDivider({ fill = 'hsl(var(--skin-page-bg))', flip, className }: SectionDividerProps) {
  return (
    <div
      aria-hidden
      className={'pointer-events-none w-full overflow-hidden leading-[0] ' + (className ?? '')}
      style={{ transform: flip ? 'scaleY(-1)' : undefined }}
    >
      <svg
        viewBox="0 0 1200 60"
        preserveAspectRatio="none"
        className="block w-full h-[40px] md:h-[60px]"
      >
        <path
          d="M0,40 C200,80 600,0 1200,40 L1200,60 L0,60 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
