'use client';

import { useEffect, useState } from 'react';
import { SKIN_STORAGE_KEY, SKINS, type Skin } from '@/lib/skin';

const LABELS: Record<Skin, string> = {
  warm: 'Warm',
  editorial: 'Editorial',
  product: 'Product',
};

const SWATCH: Record<Skin, { bg: string; ring: string }> = {
  warm: { bg: 'hsl(14 70% 53%)', ring: 'hsl(14 70% 53% / 0.35)' },
  editorial: { bg: 'hsl(38 70% 48%)', ring: 'hsl(38 70% 48% / 0.35)' },
  product: { bg: 'hsl(184 65% 32%)', ring: 'hsl(184 65% 32% / 0.35)' },
};

/**
 * Floating bottom-right widget for switching the home-page skin during
 * design review. Stores the choice in localStorage and mirrors to the
 * `data-skin` attribute on `<html>` so the no-flash script picks it up
 * on the next navigation.
 *
 * This widget is intentionally not gated behind NODE_ENV — it's harmless
 * and useful for stakeholder review. Remove the mount in layout.tsx
 * when the skin is locked in.
 */
export function SkinSwitcher() {
  const [active, setActive] = useState<Skin>('warm');
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const current = document.documentElement.getAttribute('data-skin') as Skin | null;
    setActive(current && SKINS.includes(current) ? current : 'warm');
    setReady(true);
  }, []);

  function pick(skin: Skin) {
    if (typeof document === 'undefined') return;
    setActive(skin);
    document.documentElement.setAttribute('data-skin', skin);
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, skin);
    } catch {
      /* ignore */
    }
  }

  if (!ready) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
      data-skin-switcher
    >
      {open &&
        SKINS.map((skin) => (
          <button
            key={skin}
            type="button"
            onClick={() => pick(skin)}
            aria-label={`Switch to ${LABELS[skin]} skin`}
            aria-pressed={active === skin}
            className="flex items-center gap-2 rounded-full bg-white pl-2 pr-4 py-1.5 shadow-lg ring-1 ring-black/5 hover:ring-black/15 transition-all text-sm font-medium text-zinc-800"
            style={{
              boxShadow: active === skin ? `0 0 0 2px ${SWATCH[skin].ring}` : undefined,
            }}
          >
            <span
              aria-hidden
              className="inline-block h-5 w-5 rounded-full"
              style={{ background: SWATCH[skin].bg }}
            />
            <span>{LABELS[skin]}</span>
            {active === skin && (
              <span aria-hidden className="text-zinc-400 text-xs">✓</span>
            )}
          </button>
        ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close skin switcher' : 'Open skin switcher'}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full bg-white pl-2 pr-4 py-2 shadow-lg ring-1 ring-black/10 hover:ring-black/20 transition-all text-sm font-medium text-zinc-800"
      >
        <span
          aria-hidden
          className="inline-block h-5 w-5 rounded-full"
          style={{ background: SWATCH[active].bg }}
        />
        <span>{open ? 'Close' : LABELS[active]}</span>
      </button>
    </div>
  );
}
