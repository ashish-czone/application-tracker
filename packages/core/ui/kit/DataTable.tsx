import { type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Eyebrow } from './Eyebrow';

export interface DataTableColumn<T> {
  key: string;
  /** Header label — rendered as small-caps eyebrow. */
  header: ReactNode;
  /** Cell renderer. Receives the full row. */
  cell: (row: T, index: number) => ReactNode;
  /** Right-align numeric columns. */
  align?: 'left' | 'right' | 'center';
  /** Column width as tailwind class or px string. */
  width?: string;
  /** Mark the column as numeric — applies tabular mono font by default. */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Key extractor for row identity. */
  getRowKey: (row: T, index: number) => string;
  /** Optional row click handler. */
  onRowClick?: (row: T, index: number) => void;
  /** Optional decoration rendered over a row — e.g. a StampMark. */
  rowOverlay?: (row: T, index: number) => ReactNode;
  /** Render when rows is empty. */
  emptyState?: ReactNode;
  className?: string;
  /** Stagger row reveal animation for page-load rhythm. */
  staggerReveal?: boolean;
  /**
   * When provided, only columns whose key is in this array are rendered.
   * Keys not present in `columns` are ignored. Order follows `columns`, not
   * this array — reordering is a separate concern.
   */
  visibleColumns?: string[];
}

/**
 * Dense editorial data table. No card wrapper, no round corners, no zebra
 * stripes. Just hairline rules between rows, small-caps headers, tabular
 * numerics for numeric columns, and an optional overlay per row (used to
 * place StampMark on FILED rows). Hover state is a warm paper wash.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  rowOverlay,
  emptyState,
  className,
  staggerReveal = false,
  visibleColumns,
}: DataTableProps<T>) {
  if (rows.length === 0 && emptyState) {
    return <div className={cn('w-full', className)}>{emptyState}</div>;
  }

  const renderedColumns = visibleColumns
    ? columns.filter((c) => visibleColumns.includes(c.key))
    : columns;

  return (
    <div className={cn('w-full', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-rule">
            {renderedColumns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'py-2.5 px-3 text-left font-normal align-bottom',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                <Eyebrow tone="muted">{col.header}</Eyebrow>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const lastIdx = renderedColumns.length - 1;
            return (
              <tr
                key={getRowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                className={cn(
                  'group border-b border-rule/60',
                  onRowClick && 'cursor-pointer hover:bg-paper-sunken/50 transition-colors',
                  staggerReveal && 'reveal-up',
                )}
                style={staggerReveal ? { animationDelay: `${index * 28}ms` } : undefined}
              >
                {renderedColumns.map((col, colIdx) => {
                  const overlay = rowOverlay && colIdx === lastIdx ? rowOverlay(row, index) : null;
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        'relative py-3 px-3 align-middle text-sm text-ink',
                        col.numeric && 'font-mono tabular-nums text-right',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {col.cell(row, index)}
                      {overlay && (
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                          {overlay}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
