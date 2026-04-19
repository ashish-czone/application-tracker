import type { DebugProfile } from './types';

type Listener = (profile: DebugProfile) => void;

const listeners = new Set<Listener>();

export function subscribeProfiler(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitProfile(profile: DebugProfile): void {
  for (const fn of listeners) fn(profile);
}
