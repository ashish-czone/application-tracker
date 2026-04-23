import { Check } from 'lucide-react';
import { CURATED_FONTS } from '../fonts';
import type { CuratedFont } from '../fonts';
import type { FontScale } from '../types';

interface TypographyPickerProps {
  fontFamily: string;
  fontScale: FontScale;
  onFontFamily: (id: string) => void;
  onFontScale: (scale: FontScale) => void;
  fonts?: CuratedFont[];
}

const FONT_SCALES: { id: FontScale; label: string; sampleSize: string }[] = [
  { id: 'sm', label: 'Small', sampleSize: 'text-sm' },
  { id: 'md', label: 'Medium', sampleSize: 'text-base' },
  { id: 'lg', label: 'Large', sampleSize: 'text-lg' },
];

export function TypographyPicker({
  fontFamily,
  fontScale,
  onFontFamily,
  onFontScale,
  fonts = CURATED_FONTS,
}: TypographyPickerProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {fonts.map((font) => {
          const active = fontFamily === font.id;
          return (
            <button
              key={font.id}
              type="button"
              onClick={() => onFontFamily(font.id)}
              className={`flex items-center justify-between rounded-[var(--radius)] border p-4 text-left transition-colors ${
                active
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border hover:border-foreground/30'
              }`}
            >
              <div>
                <div
                  className="text-sm font-medium text-foreground"
                  style={{ fontFamily: font.stack }}
                >
                  {font.name}
                </div>
                <div
                  className="text-xs text-muted-foreground"
                  style={{ fontFamily: font.stack }}
                >
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>

      <div>
        <div className="mb-2 text-xs text-muted-foreground">Text scale</div>
        <div className="inline-flex gap-1 rounded-[var(--radius)] border border-border bg-muted/30 p-1">
          {FONT_SCALES.map((s) => {
            const active = fontScale === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onFontScale(s.id)}
                className={`rounded-[calc(var(--radius)-0.25rem)] px-3 py-1.5 ${s.sampleSize} transition-colors ${
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
