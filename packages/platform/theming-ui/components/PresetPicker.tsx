import { Check } from 'lucide-react';
import { THEME_PRESETS } from '../presets';
import type { ThemePreset } from '../types';

interface PresetPickerProps {
  value: string;
  onChange: (presetId: string) => void;
  presets?: ThemePreset[];
  /** Tailwind column classes for the grid — override for denser / sparser layouts. */
  gridClassName?: string;
}

export function PresetPicker({
  value,
  onChange,
  presets = THEME_PRESETS,
  gridClassName = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5',
}: PresetPickerProps) {
  return (
    <div className={gridClassName}>
      {presets.map((preset) => {
        const active = value === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={`group relative flex flex-col items-start gap-2 rounded-[var(--radius)] border p-4 text-left transition-colors ${
              active
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-border hover:border-foreground/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-full border"
                style={{ background: preset.swatch }}
              />
              <div className="text-sm font-medium text-foreground">{preset.name}</div>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground">{preset.description}</p>
          </button>
        );
      })}
    </div>
  );
}
