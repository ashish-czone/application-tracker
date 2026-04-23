'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/cn';

type Mode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'site-theme';

/**
 * Three-state theme toggle. Visitor choice lives in localStorage as the
 * single source of truth:
 *   - 'light' / 'dark'  → mirrored to <html data-theme="...">
 *   - 'system' (absent) → attribute is removed; CSS reverts to the
 *     site-default rules (:root + @media).
 *
 * The no-flash script in layout.tsx runs before first paint so the attribute
 * is set before styles resolve. This component only handles user clicks.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setMode(stored);
    setReady(true);
  }, []);

  function cycle() {
    const next: Mode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setMode(next);
    applyToDom(next);
  }

  // Hide the icon swap until after hydration to avoid a flash where SSR
  // renders one state and the client reconciles to another.
  const Icon = !ready ? Monitor : mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  const label =
    mode === 'light'
      ? 'Switch to dark mode'
      : mode === 'dark'
        ? 'Switch to system mode'
        : 'Switch to light mode';

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center h-9 w-9 rounded-md text-[hsl(var(--foreground))]',
        'hover:bg-[hsl(var(--muted))] transition-colors',
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function readStored(): Mode {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore — private mode, etc. */
  }
  return 'system';
}

function applyToDom(mode: Mode) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  try {
    if (mode === 'system') {
      localStorage.removeItem(STORAGE_KEY);
      root.removeAttribute('data-theme');
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
      root.setAttribute('data-theme', mode);
    }
  } catch {
    /* ignore — best-effort */
  }
}
