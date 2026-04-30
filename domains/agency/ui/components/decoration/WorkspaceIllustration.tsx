'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../motion/useReducedMotion';

/**
 * Friendly hand-drawn-style flat illustration for the `warm` skin: a
 * soft-tinted disc holding a workspace scene (laptop, plant, hanging
 * lamp, monitor with abstract chart). Built entirely in SVG with the
 * skin anchor flowing through the line work and accent fills, so the
 * illustration recolors automatically with the active skin palette.
 *
 * The aim is "Pixeltrue / Storytale energy without copying it" —
 * rounded forms, generous negative space, two-tone fills, hand-feel
 * line weights. Subtle floating motion keeps it alive without going
 * theatrical.
 */
export function WorkspaceIllustration() {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const lampSwing =
    reduced || !mounted
      ? {}
      : {
          animate: { rotate: [-1.5, 1.5, -1.5] },
          transition: { duration: 5.5, ease: 'easeInOut' as const, repeat: Infinity },
        };

  return (
    <div className="relative aspect-square w-full max-w-[460px] mx-auto">
      <div
        aria-hidden
        className="absolute inset-[6%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--skin-anchor) / 0.10), hsl(var(--skin-anchor) / 0.04) 60%, transparent 75%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-[10%] rounded-full"
        style={{
          background: 'hsl(var(--skin-anchor-soft))',
          boxShadow: '0 30px 60px -30px hsl(var(--skin-anchor) / 0.30)',
        }}
      />

      <svg
        viewBox="0 0 400 400"
        className="absolute inset-[10%] w-[80%] h-[80%]"
        aria-hidden
      >
        <defs>
          <linearGradient id="ws-screen" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--skin-anchor) / 0.18)" />
            <stop offset="100%" stopColor="hsl(var(--skin-anchor) / 0.06)" />
          </linearGradient>
          <linearGradient id="ws-plant" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--skin-practice-3))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(var(--skin-practice-3))" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        <motion.g
          style={{ transformOrigin: '160px 40px' }}
          {...lampSwing}
        >
          <line
            x1="160"
            y1="0"
            x2="160"
            y2="60"
            stroke="hsl(var(--skin-ink))"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 140 60 L 180 60 L 175 90 L 145 90 Z"
            fill="hsl(var(--skin-anchor))"
            stroke="hsl(var(--skin-ink))"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <ellipse
            cx="160"
            cy="100"
            rx="22"
            ry="6"
            fill="hsl(var(--skin-anchor) / 0.25)"
          />
        </motion.g>

        <rect
          x="40"
          y="280"
          width="320"
          height="14"
          rx="4"
          fill="hsl(var(--skin-ink))"
          opacity="0.85"
        />

        <g>
          <rect
            x="60"
            y="180"
            width="170"
            height="110"
            rx="8"
            fill="hsl(var(--skin-ink))"
          />
          <rect
            x="68"
            y="188"
            width="154"
            height="88"
            rx="4"
            fill="url(#ws-screen)"
          />
          <path
            d="M 78 250 L 105 232 L 130 244 L 158 218 L 188 230 L 215 212"
            fill="none"
            stroke="hsl(var(--skin-anchor))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="105" cy="232" r="3" fill="hsl(var(--skin-anchor))" />
          <circle cx="158" cy="218" r="3" fill="hsl(var(--skin-anchor))" />
          <circle cx="215" cy="212" r="3" fill="hsl(var(--skin-anchor))" />
          <rect
            x="78"
            y="200"
            width="40"
            height="6"
            rx="2"
            fill="hsl(var(--skin-anchor) / 0.6)"
          />
          <rect
            x="78"
            y="210"
            width="26"
            height="4"
            rx="1.5"
            fill="hsl(var(--skin-anchor) / 0.3)"
          />
          <rect
            x="50"
            y="288"
            width="190"
            height="6"
            rx="3"
            fill="hsl(var(--skin-ink))"
          />
        </g>

        <g transform="translate(260,210)">
          <rect
            x="0"
            y="0"
            width="80"
            height="60"
            rx="10"
            fill="white"
            stroke="hsl(var(--skin-ink))"
            strokeWidth="2.5"
          />
          <rect
            x="35"
            y="60"
            width="10"
            height="14"
            fill="hsl(var(--skin-ink))"
          />
          <rect
            x="20"
            y="74"
            width="40"
            height="4"
            rx="2"
            fill="hsl(var(--skin-ink))"
          />
          <rect
            x="8"
            y="8"
            width="64"
            height="44"
            rx="4"
            fill="hsl(var(--skin-anchor) / 0.18)"
          />
          <rect
            x="14"
            y="14"
            width="22"
            height="4"
            rx="2"
            fill="hsl(var(--skin-anchor))"
          />
          <rect
            x="14"
            y="22"
            width="36"
            height="3"
            rx="1.5"
            fill="hsl(var(--skin-anchor) / 0.5)"
          />
          <rect
            x="14"
            y="30"
            width="30"
            height="3"
            rx="1.5"
            fill="hsl(var(--skin-anchor) / 0.3)"
          />
          <circle
            cx="56"
            cy="38"
            r="9"
            fill="hsl(var(--skin-practice-2))"
          />
        </g>

        <g transform="translate(40,200)">
          <ellipse
            cx="20"
            cy="78"
            rx="22"
            ry="5"
            fill="hsl(var(--skin-ink) / 0.15)"
          />
          <path
            d="M 5 78 L 8 50 L 32 50 L 35 78 Z"
            fill="hsl(var(--skin-practice-2))"
            stroke="hsl(var(--skin-ink))"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M 20 50 C 8 30, 4 18, 12 8 C 18 16, 22 22, 20 50 Z"
            fill="url(#ws-plant)"
            stroke="hsl(var(--skin-ink))"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M 20 50 C 30 32, 36 22, 30 10 C 24 18, 20 26, 20 50 Z"
            fill="url(#ws-plant)"
            stroke="hsl(var(--skin-ink))"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>

        <circle
          cx="320"
          cy="120"
          r="6"
          fill="hsl(var(--skin-practice-4))"
        />
        <path
          d="M 60 120 L 70 130 M 65 120 L 65 132"
          stroke="hsl(var(--skin-anchor))"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="350"
          cy="200"
          r="3"
          fill="hsl(var(--skin-practice-2))"
        />
      </svg>
    </div>
  );
}
