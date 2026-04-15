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
import { Checkbox } from '../form/Checkbox';
import { RadioGroup, RadioGroupItem } from '../form/RadioGroup';

function defaultGetRowId(row: unknown): string {
  return (row as Record<string, unknown>).id as string;
}

export function DataGrid<TData>({
  columns,
  data,
  enableSelection = false,
  selectionMode = 'multiple',
  getRowId = defaultGetRowId as (row: TData) => string,
  isRowSelectable,
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
  filterFields,
  filters,
  onFilterAdd,
  onStructuredFilterRemove,
  onFilterUpdate,
  onStructuredFiltersClear,
  isLoading = false,
  isError = false,
  onRetry,
  emptyState,
  storageKey,
  defaultColumnVisibility,
  renderCard,
  toolbarActions,
  rowClassName,
  rowAttributes,
  enableExport = false,
  exportFilename,
}: DataGridProps<TData>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`datagrid-columns-${storageKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Object.keys(parsed).length > 0) return parsed;
        }
      } catch { /* fall through to default */ }
    }
    return defaultColumnVisibility ?? {};
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Sync columnVisibility when defaultColumnVisibility loads async (e.g. from API layout)
  // Skip if user already has a meaningful stored preference in localStorage
  useEffect(() => {
    if (!defaultColumnVisibility || Object.keys(defaultColumnVisibility).length === 0) return;
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`datagrid-columns-${storageKey}`);
        if (stored && Object.keys(JSON.parse(stored)).length > 0) return;
      } catch { /* fall through */ }
    }
    setColumnVisibility(defaultColumnVisibility);
  }, [defaultColumnVisibility, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    if (Object.keys(columnVisibility).length === 0) return;
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
            <RadioGroup
              className="flex"
              value={row.getIsSelected() ? 'selected' : ''}
              onValueChange={() => {
                if (!row.getIsSelected()) row.toggleSelected(true);
              }}
            >
              <RadioGroupItem value="selected" aria-label="Select row" />
            </RadioGroup>
          ),
        }
      : {
          id: '_select',
          size: 40,
          enableSorting: false,
          enableHiding: false,
          header: ({ table }) => {
            const allSelected = table.getIsAllPageRowsSelected();
            const someSelected = table.getIsSomePageRowsSelected();
            return (
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) =>
                  table.toggleAllPageRowsSelected(checked === true)
                }
                aria-label="Select all rows"
              />
            );
          },
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(checked === true)}
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
    enableRowSelection: enableSelection
      ? (isRowSelectable ? (row) => isRowSelectable(row.original) : true)
      : false,
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
        filterFields={filterFields}
        filters={filters}
        onFilterAdd={onFilterAdd}
        onStructuredFilterRemove={onStructuredFilterRemove}
        onFilterUpdate={onFilterUpdate}
        onStructuredFiltersClear={onStructuredFiltersClear}
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
              rowAttributes={rowAttributes}
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
