'use client';

import { Children, isValidElement, cloneElement, useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MOTION_DURATION, MOTION_EASE } from './constants';
import { useReducedMotion } from './useReducedMotion';

export interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** Delay between successive children, in seconds. */
  step?: number;
  /** Initial delay before the first child enters. */
  delay?: number;
  /** Vertical distance (px) to translate from on entry. */
  distance?: number;
}

/**
 * Reveals each direct child with a staggered fade + slide-up. Use for
 * grids, lists, hero text rows — anywhere a row of equally-weighted
 * elements should land in sequence.
 *
 * The trigger fires once when the parent crosses 15% into the viewport,
 * and every child shares the same `whileInView` listener so the cascade
 * stays in lockstep regardless of layout.
 */
export function Stagger({
  children,
  className,
  step = 0.08,
  delay = 0,
  distance = 24,
}: StaggerProps) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (reduced || !mounted) {
    return <div className={className}>{children}</div>;
  }

  const items = Children.toArray(children);

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: step, delayChildren: delay },
        },
      }}
    >
      {items.map((child, i) => (
        <motion.div
          key={isValidElement(child) && child.key !== null ? child.key : i}
          variants={{
            hidden: { opacity: 0, y: distance },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: MOTION_DURATION.base, ease: MOTION_EASE },
            },
          }}
        >
          {isValidElement(child) ? cloneElement(child) : child}
        </motion.div>
      ))}
    </motion.div>
  );
}
