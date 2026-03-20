import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DataGridBulkAction } from './types';

interface DataGridBulkBarProps {
  selectedCount: number;
  actions: DataGridBulkAction[];
  selectedRowIds: string[];
  onClearSelection: () => void;
}

export function DataGridBulkBar({
  selectedCount,
  actions,
  selectedRowIds,
  onClearSelection,
}: DataGridBulkBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
      <span className="text-sm font-medium text-foreground">
        {selectedCount} selected
      </span>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => action.onClick(selectedRowIds)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-sm font-medium transition-colors',
                action.variant === 'destructive'
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'text-foreground hover:bg-accent',
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {action.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onClearSelection}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
