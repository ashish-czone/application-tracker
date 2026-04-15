import { ChevronDown, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../feedback/DropdownMenu';
import { cn } from '../../lib/utils';
import type { DataGridBulkAction } from './types';

interface DataGridBulkActionsMenuProps {
  selectedCount: number;
  actions: DataGridBulkAction[];
  selectedRowIds: string[];
  onClearSelection: () => void;
}

export function DataGridBulkActionsMenu({
  selectedCount,
  actions,
  selectedRowIds,
  onClearSelection,
}: DataGridBulkActionsMenuProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      data-slot="bulk-actions"
      className="inline-flex items-center rounded-md border border-input bg-background"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-slot="bulk-actions-trigger"
            className={cn(
              'inline-flex items-center gap-2 h-9 pl-3 pr-2 text-sm font-medium',
              'hover:bg-accent hover:text-accent-foreground transition-colors rounded-l-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <span>Actions</span>
            <span
              data-slot="bulk-actions-count"
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold tabular-nums"
            >
              {selectedCount}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            {selectedCount} selected
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {actions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={`${action.label}-${idx}`}
                onClick={() => action.onClick(selectedRowIds)}
                className={cn(
                  action.variant === 'destructive' && 'text-destructive focus:text-destructive',
                )}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        onClick={onClearSelection}
        aria-label="Clear selection"
        data-slot="bulk-actions-clear"
        className={cn(
          'inline-flex items-center justify-center h-9 w-8 text-muted-foreground',
          'border-l border-input hover:bg-accent hover:text-foreground transition-colors rounded-r-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
