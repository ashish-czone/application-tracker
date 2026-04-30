interface DotGridBackgroundProps {
  /** Opacity multiplier for the dot pattern. 0–1, default 0.5. */
  intensity?: number;
  className?: string;
}

/**
 * Fixed-size dot pattern that picks up the active skin anchor at low
 * opacity. Place inside a `relative` container as an absolute layer.
 */
export function DotGridBackground({ intensity = 0.5, className }: DotGridBackgroundProps) {
  return (
    <div
      aria-hidden
      className={'pointer-events-none absolute inset-0 ' + (className ?? '')}
      style={{
        backgroundImage:
          `radial-gradient(hsl(var(--skin-anchor) / ${0.18 * intensity}) 1px, transparent 1px)`,
        backgroundSize: '22px 22px',
      }}
    />
  );
}
