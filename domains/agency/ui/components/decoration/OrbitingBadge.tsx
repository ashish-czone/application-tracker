'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../motion/useReducedMotion';

export interface OrbitingBadgeProps {
  /** Lucide icon or other element shown in the colored tile. */
  icon: ReactNode;
  /** Bold lead line — the headline number or label. */
  primary: string;
  /** Secondary label below the primary. */
  secondary: string;
  /** Tile background color. Pass `hsl(var(--skin-practice-N))` from the skin palette. */
  tone: string;
  /** Yoffset amplitude for the float animation. Default 6px. */
  amplitude?: number;
  /** Phase offset (seconds) so multiple badges don't bob in unison. */
  phase?: number;
  className?: string;
}

/**
 * Small white pill with a colored icon tile + two-line label, gently
 * bobbing on Y. Sits absolutely-positioned around a hero focal element.
 * Reduced-motion users get a static pill.
 */
export function OrbitingBadge({
  icon,
  primary,
  secondary,
  tone,
  amplitude = 6,
  phase = 0,
  className,
}: OrbitingBadgeProps) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const card = (
    <div
      className={
        'inline-flex items-center gap-3 rounded-2xl bg-white pl-2 pr-4 py-2 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] ring-1 ring-black/5'
      }
    >
      <span
        className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-white"
        style={{ background: tone }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-zinc-900">{primary}</span>
        <span className="text-xs text-zinc-500">{secondary}</span>
      </span>
    </div>
  );

  if (reduced || !mounted) {
    return <div className={className}>{card}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: [0, -amplitude, 0, amplitude, 0],
      }}
      transition={{
        opacity: { duration: 0.5, delay: phase * 0.15 },
        y: {
          duration: 6,
          ease: 'easeInOut',
          repeat: Infinity,
          delay: phase,
        },
      }}
    >
      {card}
    </motion.div>
  );
}
