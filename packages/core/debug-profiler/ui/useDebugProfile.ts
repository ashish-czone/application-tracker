import { useEffect, useState } from 'react';
import { subscribeProfiler } from './profilerBus';
import type { DebugProfile } from './types';

const HISTORY_LIMIT = 50;

export function useDebugProfile(): { latest: DebugProfile | null; history: DebugProfile[] } {
  const [history, setHistory] = useState<DebugProfile[]>([]);

  useEffect(
    () =>
      subscribeProfiler((profile) => {
        setHistory((prev) => [profile, ...prev].slice(0, HISTORY_LIMIT));
      }),
    [],
  );

  return { latest: history[0] ?? null, history };
}

/**
 * Tracks requests fired since the last client-side navigation.
 * Resets whenever history.pushState / replaceState is called or popstate fires —
 * matches the natural "page load" boundary in an SPA without coupling the profiler
 * UI to a specific router library.
 */
export function useDebugProfileBatch(): {
  batch: DebugProfile[];
  path: string;
} {
  const [batch, setBatch] = useState<DebugProfile[]>([]);
  const [path, setPath] = useState<string>(() => getCurrentPath());

  useEffect(() => {
    installNavigationListener();
    return subscribeNavigation(() => {
      setBatch([]);
      setPath(getCurrentPath());
    });
  }, []);

  useEffect(
    () =>
      subscribeProfiler((profile) => {
        setBatch((prev) => [profile, ...prev]);
      }),
    [],
  );

  return { batch, path };
}

function getCurrentPath(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname + window.location.search;
}

type NavListener = () => void;
const navListeners = new Set<NavListener>();
let navPatched = false;

function subscribeNavigation(fn: NavListener): () => void {
  navListeners.add(fn);
  return () => {
    navListeners.delete(fn);
  };
}

function emitNavigation(): void {
  for (const fn of navListeners) fn();
}

function installNavigationListener(): void {
  if (navPatched || typeof window === 'undefined') return;
  navPatched = true;

  const origPush = window.history.pushState.bind(window.history);
  const origReplace = window.history.replaceState.bind(window.history);

  window.history.pushState = function patchedPush(...args: Parameters<typeof window.history.pushState>) {
    const result = origPush(...args);
    emitNavigation();
    return result;
  };
  window.history.replaceState = function patchedReplace(...args: Parameters<typeof window.history.replaceState>) {
    const result = origReplace(...args);
    emitNavigation();
    return result;
  };
  window.addEventListener('popstate', emitNavigation);
}
