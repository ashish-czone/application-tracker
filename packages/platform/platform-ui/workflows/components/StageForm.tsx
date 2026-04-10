import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label,
} from '@packages/ui';
import type { WorkflowState } from '../types';

interface StageFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage?: WorkflowState | null;
  onSubmit: (data: { name: string; label: string; color: string; sortOrder: number }) => void;
  isPending: boolean;
  nextSortOrder: number;
}

const PRESET_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#06B6D4', '#6B7280', '#1F2937',
];

export function StageForm({ open, onOpenChange, stage, onSubmit, isPending, nextSortOrder }: StageFormProps) {
  const [label, setLabel] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');
  const isEdit = !!stage;

  useEffect(() => {
    if (stage) {
      setLabel(stage.label);
      setName(stage.name);
      setColor(stage.color ?? '#6B7280');
    } else {
      setLabel('');
      setName('');
      setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    }
  }, [stage, open]);

  function handleLabelChange(value: string) {
    setLabel(value);
    if (!isEdit) {
      setName(value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !name.trim()) return;
    onSubmit({
      label: label.trim(),
      name: name.trim(),
      color,
      sortOrder: stage?.sortOrder ?? nextSortOrder,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Stage' : 'Add Stage'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stage-label">Label</Label>
            <Input
              id="stage-label"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="e.g., Phone Screen"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stage-name">Identifier</Label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., phone_screen"
              className="font-mono text-sm"
              disabled={isEdit}
            />
            <p className="text-[11px] text-muted-foreground">Lowercase, underscores only. Cannot be changed after creation.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-6 w-6 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? 'var(--foreground)' : 'transparent',
                    }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-7 rounded border border-input cursor-pointer shrink-0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !label.trim() || !name.trim()}>
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Stage'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
