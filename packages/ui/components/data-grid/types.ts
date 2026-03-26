import type { ColumnDef } from '@tanstack/react-table';
import type { ComponentType, ReactNode } from 'react';

export interface DataGridFilter {
  key: string;
  label: string;
  value: string;
}

export interface DataGridFilterOption {
  label: string;
  value: string;
}

export interface DataGridFilterConfig {
  key: string;
  label: string;
  placeholder?: string;
  options: DataGridFilterOption[];
}

export interface DataGridEmptyState {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface DataGridBulkAction {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: (selectedRows: string[]) => void;
  variant?: 'default' | 'destructive';
}

export interface DataGridProps<TData> {
  /** TanStack Table column definitions */
  columns: ColumnDef<TData, unknown>[];
  /** Row data for the current page */
  data: TData[];

  /** Enable row selection checkboxes */
  enableSelection?: boolean;
  /** Selection mode: 'single' renders radio buttons, 'multiple' renders checkboxes. Defaults to 'multiple'. */
  selectionMode?: 'single' | 'multiple';
  /** Extract a unique ID from each row for selection tracking. Defaults to (row as any).id */
  getRowId?: (row: TData) => string;
  /** Conditionally enable/disable row selection. Return false to disable selection for a row. */
  isRowSelectable?: (row: TData) => boolean;
  /** Actions shown in the bulk action bar when rows are selected */
  bulkActions?: DataGridBulkAction[];
  /** Called when row selection changes. Receives array of selected row IDs. */
  onSelectionChange?: (selectedIds: string[]) => void;

  /** Current page number (1-based) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of pages */
  pageCount: number;
  /** Total number of rows across all pages */
  totalRows: number;
  /** Called when the user navigates to a different page */
  onPageChange: (page: number) => void;
  /** Called when the user changes the page size */
  onPageSizeChange: (size: number) => void;
  /** Available page size options */
  pageSizeOptions?: number[];

  /** Currently sorted column ID */
  sortColumn?: string;
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Called when a column header is clicked for sorting */
  onSortChange?: (column: string, direction: 'asc' | 'desc') => void;

  /** Current search query */
  search?: string;
  /** Called when search input changes (debounced internally) */
  onSearchChange?: (value: string) => void;
  /** Search input placeholder text */
  searchPlaceholder?: string;

  /** Active filter chips displayed above the table */
  activeFilters?: DataGridFilter[];
  /** Called when a single filter chip is removed */
  onFilterRemove?: (key: string) => void;
  /** Called when "Clear all" filters is clicked */
  onFiltersClear?: () => void;

  /** Shows skeleton loading state */
  isLoading?: boolean;
  /** Shows error state with retry option */
  isError?: boolean;
  /** Retry callback for error state */
  onRetry?: () => void;

  /** Configuration for the empty state display */
  emptyState?: DataGridEmptyState;

  /** localStorage key for persisting column visibility preferences */
  storageKey?: string;

  /** Render function for mobile card view. If omitted, table is used on all screen sizes. */
  renderCard?: (row: TData) => ReactNode;

  /** Additional actions rendered in the toolbar (e.g., "Add" button) */
  toolbarActions?: ReactNode;

  /** Optional callback to add CSS classes to table rows based on row data */
  rowClassName?: (row: TData) => string | undefined;

  /** Enable export button in toolbar. Exports visible columns from current page data. */
  enableExport?: boolean;
  /** Filename prefix for exported files (without extension). Defaults to 'export'. */
  exportFilename?: string;
}

export interface DataGridExportColumn {
  id: string;
  header: string;
}
