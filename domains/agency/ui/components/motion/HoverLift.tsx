'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MOTION_DURATION, MOTION_EASE } from './constants';
import { useReducedMotion } from './useReducedMotion';

export interface HoverLiftProps {
  children: ReactNode;
  className?: string;
  /** Lift distance (px) on hover. */
  distance?: number;
}

/**
 * Lifts the child on hover/focus. Falls back to a plain div for users
 * who prefer reduced motion.
 */
export function HoverLift({ children, className, distance = 4 }: HoverLiftProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      whileHover={{ y: -distance }}
      whileFocus={{ y: -distance }}
      transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE }}
    >
      {children}
    </motion.div>
  );
}
