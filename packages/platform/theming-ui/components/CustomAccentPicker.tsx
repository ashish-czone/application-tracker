import { Check } from 'lucide-react';
import { Button } from '@packages/ui';

interface CustomAccentPickerProps {
  /** HSL channel string ("H S% L%") or null for "use preset default". */
  value: string | null;
  onChange: (hsl: string | null) => void;
  swatches?: { label: string; hsl: string }[];
}

const DEFAULT_SWATCHES = [
  { label: 'Rose', hsl: '346 77% 50%' },
  { label: 'Red', hsl: '0 84% 55%' },
  { label: 'Orange', hsl: '22 90% 52%' },
  { label: 'Amber', hsl: '38 92% 50%' },
  { label: 'Lime', hsl: '85 78% 42%' },
  { label: 'Emerald', hsl: '152 65% 40%' },
  { label: 'Teal', hsl: '175 70% 41%' },
  { label: 'Cyan', hsl: '190 90% 45%' },
  { label: 'Blue', hsl: '210 90% 50%' },
  { label: 'Indigo', hsl: '232 75% 58%' },
  { label: 'Violet', hsl: '262 70% 60%' },
  { label: 'Fuchsia', hsl: '295 75% 55%' },
];

export function CustomAccentPicker({
  value,
  onChange,
  swatches = DEFAULT_SWATCHES,
}: CustomAccentPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {swatches.map((s) => {
          const active = value === s.hsl;
          return (
            <button
              key={s.hsl}
              type="button"
              onClick={() => onChange(s.hsl)}
              aria-label={s.label}
              title={s.label}
              className={`relative h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${
                active ? 'border-foreground' : 'border-border'
              }`}
              style={{ background: `hsl(${s.hsl})` }}
            >
              {active && (
                <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
              )}
            </button>
          );
        })}
      </div>
      {value !== null && (
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Clear override
        </Button>
      )}
    </div>
  );
}
