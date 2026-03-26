import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  type VisibilityState,
  type RowSelectionState,
  type ColumnDef,
} from '@tanstack/react-table';
import type { DataGridProps } from './types';
import { DataGridToolbar } from './DataGridToolbar';
import { DataGridTable } from './DataGridTable';
import { DataGridPagination } from './DataGridPagination';
import { DataGridEmpty } from './DataGridEmpty';
import { DataGridBulkBar } from './DataGridBulkBar';
import { Skeleton } from '../Skeleton';

function defaultGetRowId(row: unknown): string {
  return (row as Record<string, unknown>).id as string;
}

export function DataGrid<TData>({
  columns,
  data,
  enableSelection = false,
  selectionMode = 'multiple',
  getRowId = defaultGetRowId as (row: TData) => string,
  bulkActions,
  onSelectionChange,
  page,
  pageSize,
  pageCount,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  sortColumn,
  sortDirection,
  onSortChange,
  search,
  onSearchChange,
  searchPlaceholder,
  activeFilters,
  onFilterRemove,
  onFiltersClear,
  isLoading = false,
  isError = false,
  onRetry,
  emptyState,
  storageKey,
  renderCard,
  toolbarActions,
  rowClassName,
  enableExport = false,
  exportFilename,
}: DataGridProps<TData>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (!storageKey) return {};
    try {
      const stored = localStorage.getItem(`datagrid-columns-${storageKey}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(`datagrid-columns-${storageKey}`, JSON.stringify(columnVisibility));
  }, [columnVisibility, storageKey]);

  // Clear selection when data changes (page change, filter, etc.)
  useEffect(() => {
    setRowSelection({});
  }, [page, search, sortColumn, sortDirection]);

  const isSingleSelect = selectionMode === 'single';

  // Prepend selection column when selection is enabled
  const allColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!enableSelection) return columns;

    const selectColumn: ColumnDef<TData, unknown> = isSingleSelect
      ? {
          id: '_select',
          size: 40,
          enableSorting: false,
          enableHiding: false,
          header: () => null,
          cell: ({ row }) => (
            <input
              type="radio"
              name="row-select"
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
              className="border-input"
              aria-label="Select row"
            />
          ),
        }
      : {
          id: '_select',
          size: 40,
          enableSorting: false,
          enableHiding: false,
          header: ({ table }) => (
            <input
              type="checkbox"
              checked={table.getIsAllPageRowsSelected()}
              ref={(el) => {
                if (el) el.indeterminate = table.getIsSomePageRowsSelected();
              }}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
              className="rounded border-input"
              aria-label="Select all rows"
            />
          ),
          cell: ({ row }) => (
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
              className="rounded border-input"
              aria-label="Select row"
            />
          ),
        };

    return [selectColumn, ...columns];
  }, [columns, enableSelection, isSingleSelect]);

  const table = useReactTable({
    data,
    columns: allColumns,
    pageCount,
    state: {
      columnVisibility,
      pagination: { pageIndex: page - 1, pageSize },
      rowSelection: enableSelection ? rowSelection : undefined,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: enableSelection ? setRowSelection : undefined,
    enableRowSelection: enableSelection,
    enableMultiRowSelection: enableSelection && !isSingleSelect,
    getRowId: enableSelection ? (row: TData) => getRowId(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const isEmpty = !isLoading && !isError && data.length === 0;

  const selectedRowIds = useMemo(() => {
    return Object.keys(rowSelection).filter((key) => rowSelection[key]);
  }, [rowSelection]);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(selectedRowIds);
  }, [selectedRowIds, onSelectionChange]);

  const clearSelection = useCallback(() => setRowSelection({}), []);

  return (
    <div className="space-y-4">
      <DataGridToolbar
        table={table}
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        activeFilters={activeFilters}
        onFilterRemove={onFilterRemove}
        onFiltersClear={onFiltersClear}
        toolbarActions={toolbarActions}
        enableExport={enableExport}
        exportFilename={exportFilename}
      />

      {/* Bulk action bar */}
      {enableSelection && selectedRowIds.length > 0 && bulkActions && (
        <DataGridBulkBar
          selectedCount={selectedRowIds.length}
          actions={bulkActions}
          selectedRowIds={selectedRowIds}
          onClearSelection={clearSelection}
        />
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-md border">
          <DataGridEmpty isError onRetry={onRetry} />
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-md border">
          <DataGridEmpty emptyState={emptyState} />
        </div>
      )}

      {/* Data or loading state */}
      {!isError && !isEmpty && (
        <>
          {/* Mobile card view */}
          {renderCard && (
            <div className="lg:hidden space-y-3">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))
                : data.map((row, i) => <div key={i}>{renderCard(row)}</div>)}
            </div>
          )}

          {/* Desktop table view */}
          <div className={renderCard ? 'hidden lg:block' : ''}>
            <DataGridTable
              table={table}
              isLoading={isLoading}
              pageSize={pageSize}
              onSortChange={onSortChange}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              rowClassName={rowClassName}
            />
          </div>
        </>
      )}

      {/* Pagination */}
      {!isError && totalRows > 0 && (
        <DataGridPagination
          page={page}
          pageSize={pageSize}
          pageCount={pageCount}
          totalRows={totalRows}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}
