'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

export interface ParallaxProps {
  children: ReactNode;
  className?: string;
  /** Strength multiplier — larger = more aggressive parallax. Default 0.3 (subtle). */
  strength?: number;
}

/**
 * Translates the child along Y as the user scrolls past it. Used inside
 * full-bleed hero backgrounds so the image lags behind the foreground
 * content for a depth effect.
 *
 * The wrapping element MUST have `overflow-hidden` and a smaller
 * `position` than the child — otherwise the translated child becomes
 * visible above/below its frame.
 */
export function Parallax({ children, className, strength = 0.3 }: ParallaxProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [`${-50 * strength}%`, `${50 * strength}%`]);

  if (reduced) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}
