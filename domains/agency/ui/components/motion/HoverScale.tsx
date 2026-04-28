'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MOTION_DURATION, MOTION_EASE } from './constants';
import { useReducedMotion } from './useReducedMotion';

export interface HoverScaleProps {
  children: ReactNode;
  className?: string;
  /** Scale multiplier on hover. Default 1.04 ≈ a noticeable but not bouncy lift. */
  scale?: number;
}

/**
 * Scales the child slightly on hover/focus. Designed for image tiles
 * (case studies, project cards) where the hover feedback is the image
 * subtly pushing toward the user. Pair with `overflow-hidden` on a
 * wrapping element so the scaled image stays within its frame.
 */
export function HoverScale({ children, className, scale = 1.04 }: HoverScaleProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      whileFocus={{ scale }}
      transition={{ duration: MOTION_DURATION.slow, ease: MOTION_EASE }}
    >
      {children}
    </motion.div>
  );
}
