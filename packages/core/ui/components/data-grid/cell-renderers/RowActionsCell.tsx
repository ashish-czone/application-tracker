import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../feedback/DropdownMenu';
import { cn } from '../../../lib/utils';

export interface RowAction<TData> {
  /** Menu item label. */
  label: string;
  /** Optional icon rendered before the label. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Click handler — receives the row data. */
  onClick: (row: TData) => void;
  /** Variant for destructive actions (red tint). */
  variant?: 'default' | 'destructive';
  /** Show a separator above this item. */
  separatorBefore?: boolean;
  /** Conditionally hide this action for a given row. */
  hidden?: (row: TData) => boolean;
  /** Conditionally disable this action for a given row. */
  disabled?: (row: TData) => boolean;
}

export interface RowActionsColumnOptions<TData> {
  /** Actions to render in the dropdown menu. */
  actions: RowAction<TData>[];
  /** Column id — defaults to 'actions'. */
  id?: string;
  /** Column header label — defaults to empty string. */
  header?: React.ReactNode;
  /** Column width in pixels — defaults to 48. */
  width?: number;
}

/**
 * Factory that returns a `ColumnDef` for a row-actions column. Append the
 * result to your columns array (typically as the last column). The column
 * renders an ellipsis trigger that opens a dropdown menu of actions
 * scoped to that row.
 *
 * ```ts
 * const columns = [
 *   // ...your columns
 *   createRowActionsColumn<Candidate>({
 *     actions: [
 *       { label: 'Edit', icon: Pencil, onClick: (row) => openEdit(row.id) },
 *       { label: 'Delete', icon: Trash, onClick: (row) => confirmDelete(row.id), variant: 'destructive', separatorBefore: true },
 *     ],
 *   }),
 * ];
 * ```
 */
export function createRowActionsColumn<TData>(
  options: RowActionsColumnOptions<TData>,
): ColumnDef<TData, unknown> {
  const { actions, id = 'actions', header = '', width = 48 } = options;

  return {
    id,
    header: () => <span className="sr-only">Row actions</span>,
    size: width,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }: { row: Row<TData> }) => (
      <div className="flex justify-end">
        <RowActionsMenu row={row.original} actions={actions} />
      </div>
    ),
  };
}

function RowActionsMenu<TData>({ row, actions }: { row: TData; actions: RowAction<TData>[] }) {
  const visible = actions.filter((a) => !a.hidden?.(row));
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-slot="row-actions-trigger"
          aria-label="Row actions"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {visible.map((action, idx) => {
          const Icon = action.icon;
          const isDisabled = action.disabled?.(row);
          return (
            <React.Fragment key={`${action.label}-${idx}`}>
              {action.separatorBefore && idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={isDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick(row);
                }}
                className={cn(
                  action.variant === 'destructive' && 'text-destructive focus:text-destructive',
                )}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {action.label}
              </DropdownMenuItem>
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
