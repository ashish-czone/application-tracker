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
 * Scroll-triggered fade + slide-up. Runs once per element after it
 * crosses ~20% into the viewport. Falls back to a plain visible div
 * during SSR / before hydration / when reduced-motion is on, so
 * content is never hidden if JS hasn't taken over yet.
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
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: MOTION_DURATION.base, ease: MOTION_EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
