import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Badge, Button } from '@packages/ui';
import { useUpdateSetting, useResetSetting } from '../hooks';
import type { SettingsField as SettingsFieldType } from '../types';

interface SettingFieldProps {
  field: SettingsFieldType;
  module: string;
}

export function SettingField({ field, module }: SettingFieldProps) {
  const [value, setValue] = useState<unknown>(field.value);
  const updateMutation = useUpdateSetting();
  const resetMutation = useResetSetting();

  useEffect(() => {
    setValue(field.value);
  }, [field.value]);

  const hasLocalChange = JSON.stringify(value) !== JSON.stringify(field.value);

  function handleSave() {
    updateMutation.mutate({ module, key: field.key, value });
  }

  function handleReset() {
    resetMutation.mutate({ module, key: field.key });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && hasLocalChange) {
      handleSave();
    }
  }

  return (
    <div className="grid grid-cols-[1fr,auto] gap-6 py-4 border-b border-border last:border-b-0 items-center">
      {/* Left: label + description */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <label className="text-sm font-medium text-foreground">{field.metadata.label}</label>
          <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{field.key}</code>
          {field.isOverridden && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-blue-600 border-blue-300">
              Overridden
            </Badge>
          )}
        </div>
        {field.metadata.description && (
          <p className="text-xs text-muted-foreground">{field.metadata.description}</p>
        )}
        {field.metadata.type !== 'password' && (
          <div className="text-[10px] text-muted-foreground mt-1">
            Default: <code className="bg-muted px-1 py-0.5 rounded">{JSON.stringify(field.default)}</code>
          </div>
        )}
      </div>

      {/* Right: input + actions — fixed width to prevent layout shifts */}
      <div className="flex items-center gap-2 w-[220px] justify-end">
        {/* Input */}
        {field.metadata.type === 'boolean' ? (
          <button
            type="button"
            onClick={() => {
              const newVal = !value;
              setValue(newVal);
              updateMutation.mutate({ module, key: field.key, value: newVal });
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              value ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        ) : field.metadata.options ? (
          <select
            value={String(value ?? '')}
            onChange={(e) => {
              setValue(e.target.value);
              updateMutation.mutate({ module, key: field.key, value: e.target.value });
            }}
            className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {field.metadata.options.map((opt) => {
              const optValue = typeof opt === 'string' ? opt : opt.value;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              return (
                <option key={optValue} value={optValue}>{optLabel}</option>
              );
            })}
          </select>
        ) : field.metadata.type === 'number' ? (
          <input
            type="number"
            value={String(value ?? '')}
            onChange={(e) => setValue(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            min={field.metadata.min}
            max={field.metadata.max}
            className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        ) : field.metadata.type === 'password' ? (
          <input
            type="password"
            value={String(value ?? '')}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter value"
            className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        ) : (
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        )}

        {/* Save button */}
        {hasLocalChange && field.metadata.type !== 'boolean' && !field.metadata.options ? (
          <Button size="sm" className="shrink-0" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? '...' : 'Save'}
          </Button>
        ) : (
          /* Reset button — always reserve space for consistent layout */
          <div className="w-8 shrink-0 flex justify-center">
            {field.isOverridden && (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Reset to default"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
