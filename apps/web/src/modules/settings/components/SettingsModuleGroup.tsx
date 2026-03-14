import { useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@packages/ui';
import { cn } from '@packages/ui/lib/utils';
import { SettingsFieldRenderer } from './SettingsFieldRenderer';
import type { SettingsGroup } from '../types';

interface SettingsModuleGroupProps {
  group: SettingsGroup;
  onSave: (module: string, settings: Array<{ key: string; value: unknown }>) => void;
  onReset: (module: string, key: string) => void;
  isSaving: boolean;
}

export function SettingsModuleGroup({ group, onSave, onReset, isSaving }: SettingsModuleGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const [localValues, setLocalValues] = useState<Record<string, unknown>>(() => {
    const vals: Record<string, unknown> = {};
    for (const field of group.fields) {
      vals[field.key] = field.value;
    }
    return vals;
  });

  const hasChanges = group.fields.some(
    (field) => localValues[field.key] !== field.value,
  );

  const handleChange = useCallback((key: string, value: unknown) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = () => {
    const changed = group.fields
      .filter((field) => localValues[field.key] !== field.value)
      .map((field) => ({ key: field.key, value: localValues[field.key] }));

    if (changed.length > 0) {
      onSave(group.module, changed);
    }
  };

  const handleReset = (key: string) => {
    onReset(group.module, key);
    const field = group.fields.find((f) => f.key === key);
    if (field) {
      setLocalValues((prev) => ({ ...prev, [key]: field.default }));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border/60 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-5 py-3.5 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {group.fields.length} setting{group.fields.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <>
          <div className="px-5 border-t border-border">
            {group.fields.map((field) => (
              <SettingsFieldRenderer
                key={field.key}
                field={field}
                value={localValues[field.key]}
                onChange={(value) => handleChange(field.key, value)}
                onReset={() => handleReset(field.key)}
              />
            ))}
          </div>

          {hasChanges && (
            <div className="px-5 py-3 border-t border-border flex justify-end">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
