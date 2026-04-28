'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MOTION_DURATION, MOTION_EASE } from './constants';
import { useReducedMotion } from './useReducedMotion';

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in seconds before the animation starts. */
  delay?: number;
  /** Vertical distance (px) to translate from on entry. */
  distance?: number;
}

/**
 * One-shot fade + slide-up that runs once on mount. Renders a plain
 * visible div during SSR/before hydration/with reduced-motion so the
 * content is never hidden if JS hasn't taken over yet. We intentionally
 * do not use `whileInView` — it leaves below-the-fold sections
 * opacity-0 until scrolled, which breaks fast scrollers, anchor jumps,
 * and full-page screenshots.
 */
export function Reveal({ children, className, delay = 0, distance = 24 }: RevealProps) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (reduced || !mounted) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION_DURATION.base, ease: MOTION_EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
