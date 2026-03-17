import type { ColumnDef } from '@tanstack/react-table';
import type { ComponentType, ReactNode } from 'react';

export interface DataGridFilter {
  key: string;
  label: string;
  value: string;
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

export interface DataGridProps<TData> {
  /** TanStack Table column definitions */
  columns: ColumnDef<TData, unknown>[];
  /** Row data for the current page */
  data: TData[];

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
}
