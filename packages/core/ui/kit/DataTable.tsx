import { type ReactNode, type HTMLAttributes, type MouseEvent } from 'react';
import { cn } from '../lib/utils';
import { Eyebrow } from './Eyebrow';
import { Checkbox } from '../components/form/Checkbox';

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
  /** Extra native props to spread onto each `<tr>` (e.g. mouse events). */
  rowProps?: (row: T, index: number) => HTMLAttributes<HTMLTableRowElement>;

  // ─── Selection ───────────────────────────────────────────────────
  /** Enable row selection — adds a leading checkbox column. */
  selectable?: boolean;
  /** Controlled set of currently-selected row keys. Persists across pagination. */
  selectedKeys?: Set<string>;
  /** Called with the next selection set whenever the user toggles a row
   *  or the header checkbox. The header toggles selection for the rows
   *  currently in view (i.e. the `rows` prop — typically the active page). */
  onSelectionChange?: (next: Set<string>) => void;
  /** Disable the checkbox for specific rows. Defaults to all-selectable. */
  isRowSelectable?: (row: T, index: number) => boolean;
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
  rowProps,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  isRowSelectable,
}: DataTableProps<T>) {
  if (rows.length === 0 && emptyState) {
    return <div className={cn('w-full', className)}>{emptyState}</div>;
  }

  const renderedColumns = visibleColumns
    ? columns.filter((c) => visibleColumns.includes(c.key))
    : columns;

  // Header tri-state is computed against the rows currently in view (the
  // `rows` prop, which is the active page when wrapped by DataGridShell).
  const selectableRowKeys = selectable
    ? rows
        .map((r, i) => ({ key: getRowKey(r, i), row: r, index: i }))
        .filter(({ row, index }) => (isRowSelectable ? isRowSelectable(row, index) : true))
        .map(({ key }) => key)
    : [];

  const selectedOnPage = selectable && selectedKeys
    ? selectableRowKeys.filter((k) => selectedKeys.has(k))
    : [];

  const headerState: boolean | 'indeterminate' =
    selectableRowKeys.length > 0 && selectedOnPage.length === selectableRowKeys.length
      ? true
      : selectedOnPage.length > 0
        ? 'indeterminate'
        : false;

  const toggleHeader = () => {
    if (!selectable || !selectedKeys || !onSelectionChange) return;
    const next = new Set(selectedKeys);
    if (headerState === true) {
      for (const k of selectableRowKeys) next.delete(k);
    } else {
      for (const k of selectableRowKeys) next.add(k);
    }
    onSelectionChange(next);
  };

  const toggleRow = (key: string) => {
    if (!selectable || !selectedKeys || !onSelectionChange) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  return (
    <div className={cn('w-full', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-rule">
            {selectable && (
              <th
                className="py-2.5 px-3 text-left font-normal align-bottom w-[36px]"
                aria-label="Select rows"
              >
                <Checkbox
                  checked={headerState}
                  onCheckedChange={toggleHeader}
                  disabled={selectableRowKeys.length === 0}
                  aria-label={headerState === true ? 'Deselect all rows on this page' : 'Select all rows on this page'}
                />
              </th>
            )}
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
            const rowKey = getRowKey(row, index);
            const rowSelectable = selectable
              ? (isRowSelectable ? isRowSelectable(row, index) : true)
              : false;
            const rowChecked = !!selectedKeys?.has(rowKey);
            return (
              <tr
                key={rowKey}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                className={cn(
                  'group border-b border-rule/60',
                  onRowClick && 'cursor-pointer hover:bg-paper-sunken/50 transition-colors',
                  staggerReveal && 'reveal-up',
                  rowChecked && 'bg-paper-sunken/40',
                )}
                style={staggerReveal ? { animationDelay: `${index * 28}ms` } : undefined}
                {...(rowProps ? rowProps(row, index) : {})}
              >
                {selectable && (
                  <td
                    className="py-3 px-3 align-middle w-[36px]"
                    onClick={(e: MouseEvent<HTMLTableCellElement>) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={rowChecked}
                      onCheckedChange={() => toggleRow(rowKey)}
                      disabled={!rowSelectable}
                      aria-label={rowChecked ? 'Deselect row' : 'Select row'}
                    />
                  </td>
                )}
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
