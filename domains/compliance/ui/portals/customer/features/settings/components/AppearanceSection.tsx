import { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Laptop,
  LayoutGrid,
  LayoutList,
  type LucideIcon,
} from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import type { ThemeMode, Density } from '../types';
import { SectionDivider } from './settingsFormPrimitives';

const THEME_STORAGE_KEY = 'compliance:appearance:theme';
const DENSITY_STORAGE_KEY = 'compliance:appearance:density';

function readPref<T extends string>(key: string, fallback: T, valid: ReadonlyArray<T>): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return valid.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable (private mode, quota); silently swallow.
  }
}

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: LucideIcon;
  desc: string;
}

interface DensityOption {
  value: Density;
  label: string;
  icon: LucideIcon;
  desc: string;
}

const THEMES: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: Sun, desc: 'Warm parchment tones' },
  { value: 'dark', label: 'Dark', icon: Moon, desc: 'Graphite & bone' },
  { value: 'system', label: 'System', icon: Laptop, desc: 'Match OS preference' },
];

const DENSITIES: DensityOption[] = [
  { value: 'comfortable', label: 'Comfortable', icon: LayoutGrid, desc: 'More whitespace, larger rows' },
  { value: 'compact', label: 'Compact', icon: LayoutList, desc: 'Tighter spacing, more data' },
];

const THEME_VALUES: ThemeMode[] = ['light', 'dark', 'system'];
const DENSITY_VALUES: Density[] = ['comfortable', 'compact'];

export function AppearanceSection() {
  const [theme, setTheme] = useState<ThemeMode>(() =>
    readPref<ThemeMode>(THEME_STORAGE_KEY, 'light', THEME_VALUES),
  );
  const [density, setDensity] = useState<Density>(() =>
    readPref<Density>(DENSITY_STORAGE_KEY, 'comfortable', DENSITY_VALUES),
  );

  useEffect(() => {
    writePref(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    writePref(DENSITY_STORAGE_KEY, density);
  }, [density]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Appearance</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Customize how the application looks and feels.
        </p>
      </div>

      <div>
        <Eyebrow tone="muted" mark="&sect;">
          Theme
        </Eyebrow>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const selected = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={`flex flex-col items-center gap-3 px-4 py-5 border transition-colors ${
                  selected
                    ? 'border-authority bg-authority/5'
                    : 'border-rule bg-paper hover:border-ink-muted'
                }`}
              >
                <div
                  className={`w-full h-16 border flex items-center justify-center ${
                    t.value === 'dark'
                      ? 'bg-[#1a1c1f] border-[#333]'
                      : t.value === 'light'
                        ? 'bg-[#F6F3EC] border-[#E1DBCE]'
                        : 'bg-gradient-to-r from-[#F6F3EC] to-[#1a1c1f] border-rule'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      t.value === 'dark' ? 'text-[#E8E1D3]' : 'text-[#1A1D21]'
                    }`}
                    strokeWidth={1.5}
                  />
                </div>
                <div className="text-center">
                  <span
                    className={`block text-sm font-sans ${selected ? 'text-authority font-medium' : 'text-ink'}`}
                  >
                    {t.label}
                  </span>
                  <span className="block text-[11px] font-serif italic text-ink-muted mt-0.5">
                    {t.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <SectionDivider />

      <div>
        <Eyebrow tone="muted" mark="&sect;">
          Table density
        </Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-3 max-w-md">
          {DENSITIES.map((d) => {
            const Icon = d.icon;
            const selected = density === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setDensity(d.value)}
                className={`flex items-center gap-3 px-4 py-3 border transition-colors text-left ${
                  selected
                    ? 'border-authority bg-authority/5'
                    : 'border-rule bg-paper hover:border-ink-muted'
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-none ${selected ? 'text-authority' : 'text-ink-muted'}`}
                  strokeWidth={1.5}
                />
                <div>
                  <span
                    className={`block text-sm font-sans ${selected ? 'text-authority font-medium' : 'text-ink'}`}
                  >
                    {d.label}
                  </span>
                  <span className="block text-[11px] font-serif italic text-ink-muted mt-0.5">
                    {d.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
