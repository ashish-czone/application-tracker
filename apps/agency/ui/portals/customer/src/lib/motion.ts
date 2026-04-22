'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the user's `(prefers-reduced-motion: reduce)` media query. Returns
 * `true` when the user has opted out of animation — callers should skip
 * transitions, scroll reveals, and autoplaying motion when this is true.
 *
 * Initialises to `false` on the server so markup is stable for SSR; the
 * first client render updates if the user's preference differs.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return reduced;
}

/** Standard durations (seconds) used across motion primitives. */
export const MOTION_DURATION = {
  fast: 0.2,
  base: 0.35,
  slow: 0.6,
} as const;

/** Standard easing curves. `ease-out-expo`-ish — feels crisp, never bouncy. */
export const MOTION_EASE = [0.16, 1, 0.3, 1] as const;
