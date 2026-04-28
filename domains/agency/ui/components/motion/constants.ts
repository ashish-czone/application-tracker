/** Standard durations (seconds) used across motion primitives. */
export const MOTION_DURATION = {
  fast: 0.2,
  base: 0.35,
  slow: 0.6,
} as const;

/** Standard easing curve. ease-out-expo-ish — feels crisp, never bouncy. */
export const MOTION_EASE = [0.16, 1, 0.3, 1] as const;
