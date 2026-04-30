'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../motion/useReducedMotion';

/**
 * Abstract focal element for the `product` skin: three overlapping UI
 * surfaces — a dashboard card, a phone, and a code window — drifting
 * gently. No external assets, fully theme-aware.
 */
export function ProductStackIllustration() {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const float = (delay: number, range: number) =>
    reduced || !mounted
      ? {}
      : {
          animate: { y: [0, -range, 0, range, 0] },
          transition: {
            duration: 8,
            ease: 'easeInOut' as const,
            repeat: Infinity,
            delay,
          },
        };

  return (
    <div className="relative aspect-[5/4] w-full max-w-[520px] mx-auto">
      <div
        aria-hidden
        className="absolute inset-0 rounded-[40%] blur-3xl opacity-60"
        style={{
          background:
            'radial-gradient(closest-side, hsl(var(--skin-anchor) / 0.18), transparent)',
        }}
      />

      <motion.div
        className="absolute left-[6%] top-[18%] w-[62%] aspect-[5/3] rounded-2xl bg-white ring-1 ring-black/5 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.18)] p-4 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        {...float(0, 8)}
        {...(mounted && !reduced ? { animate: { ...float(0, 8).animate, opacity: 1 } } : {})}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <span className="h-2 w-2 rounded-full bg-rose-300" />
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          <span className="ml-2 text-[10px] font-mono text-zinc-400">dashboard</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-md bg-zinc-50 ring-1 ring-zinc-100 p-2">
              <div className="h-1.5 w-6 rounded bg-zinc-200" />
              <div className="mt-1.5 h-2 w-10 rounded bg-zinc-300" />
            </div>
          ))}
        </div>
        <svg viewBox="0 0 200 60" className="w-full h-14">
          <defs>
            <linearGradient id="stack-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--skin-anchor))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--skin-anchor))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d="M0 45 L20 38 L40 42 L60 28 L80 34 L100 22 L120 30 L140 18 L160 26 L180 14 L200 22 L200 60 L0 60 Z"
            fill="url(#stack-area)"
          />
          <path
            d="M0 45 L20 38 L40 42 L60 28 L80 34 L100 22 L120 30 L140 18 L160 26 L180 14 L200 22"
            fill="none"
            stroke="hsl(var(--skin-anchor))"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>

      <motion.div
        className="absolute right-[6%] top-[6%] w-[26%] aspect-[1/2] rounded-[20px] bg-white ring-1 ring-black/5 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.22)] p-2 overflow-hidden"
        initial={{ opacity: 0, y: 20, rotate: 4 }}
        animate={
          mounted && !reduced
            ? { opacity: 1, y: [0, -10, 0, 6, 0], rotate: [4, 6, 4, 2, 4] }
            : { opacity: 1, rotate: 4 }
        }
        transition={{
          opacity: { duration: 0.6, delay: 0.2 },
          y: { duration: 7, ease: 'easeInOut', repeat: Infinity, delay: 0.5 },
          rotate: { duration: 7, ease: 'easeInOut', repeat: Infinity, delay: 0.5 },
        }}
      >
        <div className="h-1 w-6 rounded-full bg-zinc-200 mx-auto" />
        <div className="mt-3 space-y-2">
          <div className="h-12 rounded-lg" style={{ background: 'hsl(var(--skin-anchor) / 0.12)' }}>
            <div className="p-2">
              <div className="h-1.5 w-10 rounded bg-zinc-300 mb-1.5" />
              <div className="h-2 w-14 rounded" style={{ background: 'hsl(var(--skin-anchor))' }} />
            </div>
          </div>
          <div className="h-8 rounded-md bg-zinc-50 ring-1 ring-zinc-100" />
          <div className="h-8 rounded-md bg-zinc-50 ring-1 ring-zinc-100" />
          <div className="h-8 rounded-md bg-zinc-50 ring-1 ring-zinc-100" />
        </div>
      </motion.div>

      <motion.div
        className="absolute left-[2%] bottom-[6%] w-[52%] rounded-xl bg-zinc-900 text-white shadow-[0_24px_48px_-24px_rgba(15,23,42,0.30)] p-3 font-mono text-[10px] overflow-hidden"
        initial={{ opacity: 0, y: 20, rotate: -3 }}
        animate={
          mounted && !reduced
            ? { opacity: 1, y: [0, 6, 0, -8, 0], rotate: [-3, -2, -3, -4, -3] }
            : { opacity: 1, rotate: -3 }
        }
        transition={{
          opacity: { duration: 0.6, delay: 0.4 },
          y: { duration: 9, ease: 'easeInOut', repeat: Infinity, delay: 1 },
          rotate: { duration: 9, ease: 'easeInOut', repeat: Infinity, delay: 1 },
        }}
      >
        <div className="flex items-center gap-1.5 mb-2 opacity-70">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </div>
        <div className="text-zinc-400">
          <span className="text-purple-300">const</span>{' '}
          <span className="text-sky-300">studio</span> = {'{'}
        </div>
        <div className="pl-3 text-zinc-500">
          ship: <span className="text-emerald-300">true</span>,
        </div>
        <div className="pl-3 text-zinc-500">
          theatrics: <span className="text-rose-300">false</span>,
        </div>
        <div className="pl-3 text-zinc-500">
          team: <span className="text-amber-300">11</span>,
        </div>
        <div className="text-zinc-400">{'}'}</div>
      </motion.div>
    </div>
  );
}
