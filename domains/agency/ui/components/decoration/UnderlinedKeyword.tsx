'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../motion/useReducedMotion';
import { useSkin } from './useSkin';

export interface UnderlinedKeywordProps {
  children: ReactNode;
  /** Delay before stroke-in animation. */
  delay?: number;
}

/**
 * Wraps a headline keyword in skin-coloured emphasis + a stroked-in
 * underline whose shape varies by skin:
 *   warm      → hand-drawn wavy stroke
 *   editorial → highlighter slab behind the text
 *   product   → straight slab with a slight skew
 *
 * Stroke draws via framer-motion `pathLength`. Reduced-motion users get
 * the final state immediately.
 */
export function UnderlinedKeyword({ children, delay = 0.4 }: UnderlinedKeywordProps) {
  const skin = useSkin();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const colorVar = 'hsl(var(--skin-anchor))';

  if (skin === 'editorial') {
    return (
      <span className="relative inline-block whitespace-nowrap">
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-0.5 h-[0.55em] -z-10"
          style={{
            background: 'hsl(var(--skin-anchor) / 0.28)',
            transform: 'skewX(-6deg)',
            borderRadius: '2px',
          }}
        />
        <span style={{ color: 'hsl(var(--skin-anchor-ink))' }}>{children}</span>
      </span>
    );
  }

  if (skin === 'product') {
    return (
      <span className="relative inline-block whitespace-nowrap" style={{ color: colorVar }}>
        {children}
        {mounted && !reduced ? (
          <motion.span
            aria-hidden
            className="absolute left-0 right-0 -bottom-1 block h-[0.18em] origin-left"
            style={{
              background: colorVar,
              transform: 'skewX(-12deg)',
              borderRadius: '2px',
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
          />
        ) : (
          <span
            aria-hidden
            className="absolute left-0 right-0 -bottom-1 block h-[0.18em]"
            style={{ background: colorVar, transform: 'skewX(-12deg)', borderRadius: '2px' }}
          />
        )}
      </span>
    );
  }

  // warm — hand-drawn wavy stroke
  return (
    <span className="relative inline-block whitespace-nowrap" style={{ color: colorVar }}>
      {children}
      <svg
        aria-hidden
        className="absolute left-0 right-0 -bottom-2 w-full overflow-visible"
        viewBox="0 0 200 14"
        preserveAspectRatio="none"
        style={{ height: '0.45em' }}
      >
        {mounted && !reduced ? (
          <motion.path
            d="M2 8 C 30 2, 60 12, 100 6 S 170 12, 198 5"
            fill="none"
            stroke={colorVar}
            strokeWidth={3}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
          />
        ) : (
          <path
            d="M2 8 C 30 2, 60 12, 100 6 S 170 12, 198 5"
            fill="none"
            stroke={colorVar}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
      </svg>
    </span>
  );
}
