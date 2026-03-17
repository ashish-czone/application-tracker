import { useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  type VisibilityState,
} from '@tanstack/react-table';
import type { DataGridProps } from './types';
import { DataGridToolbar } from './DataGridToolbar';
import { DataGridTable } from './DataGridTable';
import { DataGridPagination } from './DataGridPagination';
import { DataGridEmpty } from './DataGridEmpty';
import { Skeleton } from '../Skeleton';

export function DataGrid<TData>({
  columns,
  data,
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
}: DataGridProps<TData>) {
  // Column visibility state persisted to localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (!storageKey) return {};
    try {
      const stored = localStorage.getItem(`datagrid-columns-${storageKey}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(`datagrid-columns-${storageKey}`, JSON.stringify(columnVisibility));
  }, [columnVisibility, storageKey]);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      columnVisibility,
      pagination: { pageIndex: page - 1, pageSize },
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const isEmpty = !isLoading && !isError && data.length === 0;

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
      />

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
