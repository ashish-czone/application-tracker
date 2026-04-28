'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the user's `(prefers-reduced-motion: reduce)` media query.
 * Initialises to `false` on the server so SSR markup is stable; the
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
