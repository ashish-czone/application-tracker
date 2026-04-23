interface RadiusPickerProps {
  value: number;
  onChange: (radius: number) => void;
  options?: { value: number; label: string }[];
}

const DEFAULT_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 0.375, label: 'Small' },
  { value: 0.625, label: 'Medium' },
  { value: 1, label: 'Large' },
];

export function RadiusPicker({ value, onChange, options = DEFAULT_OPTIONS }: RadiusPickerProps) {
  return (
    <div className="inline-flex gap-1 rounded-[var(--radius)] border border-border bg-muted/30 p-1">
      {options.map((r) => {
        const active = value === r.value;
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange(r.value)}
            className={`rounded-[calc(var(--radius)-0.25rem)] px-3 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
