import { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import { Button, Input } from '@packages/ui';

export interface PicklistOptionInput {
  label: string;
  value: string;
  isDefault?: boolean;
}

interface PicklistOptionsEditorProps {
  options: PicklistOptionInput[];
  onChange: (options: PicklistOptionInput[]) => void;
}

export function PicklistOptionsEditor({ options, onChange }: PicklistOptionsEditorProps) {
  const [newLabel, setNewLabel] = useState('');

  function addOption() {
    if (!newLabel.trim()) return;
    const value = newLabel.trim().toLowerCase().replace(/\s+/g, '-');
    onChange([...options, { label: newLabel.trim(), value }]);
    setNewLabel('');
  }

  function removeOption(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, label: string) {
    const updated = [...options];
    updated[index] = { ...updated[index], label };
    onChange(updated);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Options</label>

      {options.length > 0 && (
        <div className="space-y-1 rounded-md border p-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
              <Input
                value={opt.label}
                onChange={(e) => updateOption(idx, e.target.value)}
                className="h-7 text-sm flex-1"
              />
              <span className="text-xs text-muted-foreground w-20 truncate">{opt.value}</span>
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="p-0.5 rounded text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
          placeholder="New option label..."
          className="h-7 text-sm flex-1"
        />
        <Button type="button" size="sm" variant="outline" onClick={addOption} className="h-7 px-2 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}
