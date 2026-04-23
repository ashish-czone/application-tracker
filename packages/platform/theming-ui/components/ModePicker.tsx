import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '../types';

interface ModePickerProps {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export function ModePicker({ value, onChange }: ModePickerProps) {
  return (
    <div className="inline-flex gap-1 rounded-[var(--radius)] border border-border bg-muted/30 p-1">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`flex items-center gap-1.5 rounded-[calc(var(--radius)-0.25rem)] px-3 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
