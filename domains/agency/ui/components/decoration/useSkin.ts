'use client';

import { useEffect, useState } from 'react';

export type Skin = 'warm' | 'editorial' | 'product';

const VALID: readonly Skin[] = ['warm', 'editorial', 'product'] as const;

/**
 * Reads the active skin from <html data-skin="..."> on the client. SSR
 * gets `'warm'` to keep markup stable, the first effect run picks up the
 * real value (set by the no-flash script before paint). Subscribes to
 * mutations so the SkinSwitcher updates downstream components live.
 */
export function useSkin(): Skin {
  const [skin, setSkin] = useState<Skin>('warm');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const read = () => {
      const v = root.getAttribute('data-skin');
      setSkin(VALID.includes(v as Skin) ? (v as Skin) : 'warm');
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-skin'] });
    return () => observer.disconnect();
  }, []);

  return skin;
}
