import { Input } from '@packages/ui';
import { RotateCcw } from 'lucide-react';
import { cn } from '@packages/ui/lib/utils';
import type { SettingsField } from '../types';

interface SettingsFieldRendererProps {
  field: SettingsField;
  value: unknown;
  onChange: (value: unknown) => void;
  onReset: () => void;
}

export function SettingsFieldRenderer({ field, value, onChange, onReset }: SettingsFieldRendererProps) {
  const { metadata } = field;

  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">{metadata.label}</label>
          {metadata.restartRequired && (
            <span className="text-[10px] font-medium bg-warning/10 text-warning border border-warning/20 rounded px-1.5 py-0.5">
              Restart required
            </span>
          )}
        </div>
        {metadata.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{metadata.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {renderInput(metadata.type, value, onChange, metadata)}

        {field.isOverridden && (
          <button
            onClick={onReset}
            title="Reset to default"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function renderInput(
  type: string,
  value: unknown,
  onChange: (value: unknown) => void,
  metadata: SettingsField['metadata'],
) {
  switch (type) {
    case 'boolean':
      return (
        <button
          role="switch"
          aria-checked={Boolean(value)}
          onClick={() => onChange(!value)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
            value ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
              value ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      );

    case 'number':
      return (
        <Input
          type="number"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          min={metadata.min}
          max={metadata.max}
          className="w-32 h-8 text-sm"
        />
      );

    case 'enum':
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          {metadata.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'string':
    case 'duration':
    default:
      return (
        <Input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 h-8 text-sm"
        />
      );
  }
}
