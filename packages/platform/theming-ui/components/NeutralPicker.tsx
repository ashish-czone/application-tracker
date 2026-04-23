import { Check } from 'lucide-react';
import { AUTO_NEUTRAL_ID, NEUTRAL_PRESETS } from '../neutrals';
import type { NeutralPreset } from '../types';

interface NeutralPickerProps {
  value: string;
  onChange: (neutralId: string) => void;
  /** Whether to show the "Auto — match preset tint" option. */
  includeAuto?: boolean;
  neutrals?: NeutralPreset[];
  gridClassName?: string;
}

const AUTO_SWATCH =
  'conic-gradient(from 180deg, hsl(240 6% 60%), hsl(210 14% 60%), hsl(140 10% 60%), hsl(30 12% 60%), hsl(265 14% 60%), hsl(240 6% 60%))';

export function NeutralPicker({
  value,
  onChange,
  includeAuto = true,
  neutrals = NEUTRAL_PRESETS,
  gridClassName = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6',
}: NeutralPickerProps) {
  return (
    <div className={gridClassName}>
      {includeAuto && (
        <button
          type="button"
          onClick={() => onChange(AUTO_NEUTRAL_ID)}
          className={`group relative flex flex-col items-start gap-2 rounded-[var(--radius)] border p-4 text-left transition-colors ${
            value === AUTO_NEUTRAL_ID
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-border hover:border-foreground/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full border" style={{ background: AUTO_SWATCH }} />
            <div className="text-sm font-medium text-foreground">Auto</div>
            {value === AUTO_NEUTRAL_ID && <Check className="h-3.5 w-3.5 text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">Match preset tint</p>
        </button>
      )}
      {neutrals.map((neutral) => {
        const active = value === neutral.id;
        return (
          <button
            key={neutral.id}
            type="button"
            onClick={() => onChange(neutral.id)}
            className={`group relative flex flex-col items-start gap-2 rounded-[var(--radius)] border p-4 text-left transition-colors ${
              active
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-border hover:border-foreground/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-full border"
                style={{ background: neutral.swatch }}
              />
              <div className="text-sm font-medium text-foreground">{neutral.name}</div>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground">{neutral.description}</p>
          </button>
        );
      })}
    </div>
  );
}
