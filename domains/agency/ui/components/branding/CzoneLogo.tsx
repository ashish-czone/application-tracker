import type { CSSProperties } from 'react';

export interface CzoneLogoProps {
  /** Pixel height of the wordmark line. Mark scales proportionally. */
  size?: number;
  /** Hide the wordmark and render only the mark. */
  markOnly?: boolean;
  className?: string;
}

/**
 * czone brand mark + wordmark.
 *
 * The mark is a thick, open `C` traced from a 280° arc with a focal
 * dot dropped inside the opening — the dot reads as "the zone": a
 * single point of focus inside an enclosing space. A soft anchor-
 * tinted disc behind the mark gives it presence at small sizes
 * without competing with the type around it.
 *
 * Both the arc and the dot pull from `--skin-anchor`, so the logo
 * recolors automatically with the active skin (terracotta in warm,
 * mustard in editorial, teal in product). The wordmark uses
 * `--skin-ink` with a fallback to the base foreground for routes
 * that haven't opted into the skin layer.
 *
 * Sized via `size` (pixels) — the mark is ~1.05× the size, the
 * wordmark sits at ~0.72× so the cap height roughly matches the
 * mark's outer radius.
 */
export function CzoneLogo({ size = 22, markOnly, className }: CzoneLogoProps) {
  const markPx = Math.round(size * 1.18);
  const wordPx = Math.round(size * 0.95);
  const stroke = 3.4;

  const wrapperStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: Math.round(size * 0.36),
    color: 'hsl(var(--skin-ink, var(--foreground, 240 6% 10%)))',
  };

  return (
    <span className={className} style={wrapperStyle}>
      <svg
        viewBox="0 0 28 28"
        width={markPx}
        height={markPx}
        aria-hidden
        style={{ display: 'block', flexShrink: 0 }}
      >
        <circle
          cx={14}
          cy={14}
          r={13}
          fill="hsl(var(--skin-anchor) / 0.12)"
        />
        <path
          d="M 21.5 8.4 A 8 8 0 1 0 21.5 19.6"
          fill="none"
          stroke="hsl(var(--skin-anchor))"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <circle cx={19.6} cy={14} r={2.4} fill="hsl(var(--skin-anchor))" />
      </svg>
      {!markOnly && (
        <span
          style={{
            fontWeight: 700,
            fontSize: wordPx,
            letterSpacing: '-0.035em',
            lineHeight: 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          czone
        </span>
      )}
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        czone
      </span>
    </span>
  );
}
