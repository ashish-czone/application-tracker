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
 * Reveals each direct child with a staggered fade + slide-up on mount.
 * Renders a plain visible div during SSR/before hydration/with reduced
 * motion so children are never hidden waiting for JS or scroll. We do
 * not use `whileInView` — it leaves below-the-fold sections invisible
 * until scrolled into view, which breaks fast scrollers and full-page
 * screenshots.
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
      animate="show"
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
