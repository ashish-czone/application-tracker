'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MOTION_DURATION, MOTION_EASE, useReducedMotion } from '@/lib/motion';

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in seconds before the animation starts. */
  delay?: number;
  /** Vertical distance (px) to translate from on entry. */
  distance?: number;
}

/**
 * Scroll-triggered fade + slide-up. Runs once per element, once it
 * crosses ~20% into the viewport. Skips all motion when the user has
 * `prefers-reduced-motion: reduce` — the child still renders, just
 * without the entrance effect.
 */
export function Reveal({ children, className, delay = 0, distance = 24 }: RevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: MOTION_DURATION.base, ease: MOTION_EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
