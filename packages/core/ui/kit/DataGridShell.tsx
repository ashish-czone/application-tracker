import { type ReactNode, type HTMLAttributes, useState, useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { DataTable, type DataTableColumn } from './DataTable';
import { Pagination } from './Pagination';
import { ColumnChooser } from './ColumnChooser';
import { ActiveFilterChips, type ActiveFilter } from './ActiveFilterChips';

export interface DataGridShellProps<T> {
  // ─── Table data ──────────────────────────────────────────────────
  columns: DataTableColumn<T>[];
  /** Full filtered row set — DataGrid handles pagination internally. */
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T, index: number) => void;
  rowOverlay?: (row: T, index: number) => ReactNode;
  rowProps?: (row: T, index: number) => HTMLAttributes<HTMLTableRowElement>;
  emptyState?: ReactNode;
  staggerReveal?: boolean;

  // ─── Column chooser ──────────────────────────────────────────────
  /** Column keys that cannot be hidden. */
  requiredColumns?: string[];
  /** Controlled visible columns — when provided, DataGrid defers to the
   *  consumer for column visibility (used with hideToolbar + external ColumnChooser). */
  visibleColumns?: string[];
  /** Called when visible columns change. Only fired in uncontrolled mode. */
  onVisibleColumnsChange?: (keys: string[]) => void;

  // ─── Slots ───────────────────────────────────────────────────────
  /** Left side of toolbar — search input, filter popovers, etc. */
  filters?: ReactNode;
  /** Right side of toolbar, before Export & Columns buttons. */
  actions?: ReactNode;
  /** Active filter chips rendered below the toolbar. */
  activeFilters?: ActiveFilter[];
  onClearFilters?: () => void;

  // ─── Count ───────────────────────────────────────────────────────
  /** Total unfiltered count for the "X of Y" display. Defaults to rows.length. */
  totalRows?: number;

  // ─── Pagination ──────────────────────────────────────────────────
  defaultPageSize?: number;

  // ─── Export ──────────────────────────────────────────────────────
  /** Called when the Export button is clicked. Button is always rendered. */
  onExport?: () => void;

  // ─── Layout ──────────────────────────────────────────────────────
  /** Hide the toolbar (filters, count, export, columns). Useful when the
   *  toolbar is rendered externally (e.g. shared across multiple view modes). */
  hideToolbar?: boolean;

  // ─── Container ───────────────────────────────────────────────────
  className?: string;
  /** Extra props spread onto the table container div (e.g. onMouseLeave). */
  containerProps?: HTMLAttributes<HTMLDivElement>;
}

/**
 * Instrument-kit composite data grid. Composes the toolbar (filters, count,
 * export, column chooser), active-filter chips, DataTable, and Pagination
 * into a single reusable shell for the editorial design system screens.
 *
 * Pagination state is fully managed internally — consumers pass the complete
 * filtered row set and DataGridShell slices for the current page. The page
 * resets to 1 whenever the row set changes (e.g. after filtering).
 *
 * Column visibility is also managed internally via ColumnChooser.
 */
export function DataGridShell<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  rowOverlay,
  rowProps,
  emptyState,
  staggerReveal,
  requiredColumns = [],
  visibleColumns: controlledVisibleColumns,
  onVisibleColumnsChange,
  filters,
  actions,
  activeFilters,
  onClearFilters,
  totalRows,
  defaultPageSize = 10,
  onExport,
  hideToolbar = false,
  className,
  containerProps,
}: DataGridShellProps<T>) {
  // ─── Internal state ────────────────────────────────────────────────
  const allColumnKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<string[]>(allColumnKeys);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Controlled vs uncontrolled column visibility.
  const isControlled = controlledVisibleColumns !== undefined;
  const visibleColumns = isControlled ? controlledVisibleColumns : internalVisibleColumns;
  const setVisibleColumns = isControlled
    ? (keys: string[]) => onVisibleColumnsChange?.(keys)
    : setInternalVisibleColumns;

  // Reset to page 1 when the filtered row set changes.
  const rowCount = rows.length;
  useEffect(() => {
    setPage(1);
  }, [rowCount]);

  // Sync visible columns if the column definition changes (uncontrolled only).
  useEffect(() => {
    if (!isControlled) setInternalVisibleColumns(allColumnKeys);
  }, [allColumnKeys, isControlled]);

  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const displayTotal = totalRows ?? rowCount;

  // ─── Column chooser items ──────────────────────────────────────────
  const columnChooserItems = useMemo(
    () =>
      columns.map((c) => ({
        key: c.key,
        label: c.header,
        required: requiredColumns.includes(c.key),
      })),
    [columns, requiredColumns],
  );

  return (
    <div className={cn('', className)}>
      {/* ─── Toolbar ────────────────────────────────────────────────── */}
      {!hideToolbar && (
        <div className="flex items-center gap-3 py-3 border-b border-rule">
          {filters}

          <div className="ml-auto flex items-center gap-3">
            <span className="font-mono text-[11px] tabular-nums text-ink-soft">
              {rowCount} of {displayTotal}
            </span>
            {actions}
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-2.5 py-[5px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-ink-soft bg-paper-raised hover:border-ink hover:text-ink transition-colors"
              aria-label="Export"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Export</span>
            </button>
            <ColumnChooser
              columns={columnChooserItems}
              visible={visibleColumns}
              onChange={setVisibleColumns}
            />
          </div>
        </div>
      )}

      {/* ─── Active filter chips ────────────────────────────────────── */}
      {activeFilters && activeFilters.length > 0 && (
        <ActiveFilterChips filters={activeFilters} onClearAll={onClearFilters} />
      )}

      {/* ─── Table + Pagination ─────────────────────────────────────── */}
      <div
        className="mt-4 bg-paper-raised border border-rule overflow-x-auto"
        {...containerProps}
      >
        <DataTable
          columns={columns}
          visibleColumns={visibleColumns}
          rows={paginatedRows}
          getRowKey={getRowKey}
          onRowClick={onRowClick}
          rowOverlay={rowOverlay}
          rowProps={rowProps}
          emptyState={emptyState}
          staggerReveal={staggerReveal}
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          pageCount={pageCount}
          totalRows={rowCount}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
