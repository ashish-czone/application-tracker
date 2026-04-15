import type { ColumnDef } from '@tanstack/react-table';
import type { ComponentType, ReactNode } from 'react';
import type { FilterOperator, FilterExpression } from './filter-types';

// ---------------------------------------------------------------------------
// Legacy filter types (backward compat — used by old DataGridFilters dropdown pattern)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// New filter types (used by DataGridFilterBuilder chip pattern)
// ---------------------------------------------------------------------------

export interface DataGridFilterFieldOption {
  label: string;
  value: string;
}

export interface DataGridFilterField {
  /** Unique field key (matches API field name) */
  key: string;
  /** Display label shown in field picker */
  label: string;
  /** Field type — determines which operators are available and what value input to render */
  fieldType: string;
  /** Override operators for this field (defaults to OPERATORS_BY_FIELD_TYPE[fieldType]) */
  operators?: FilterOperator[];
  /** Static options for picklist/lookup fields */
  options?: DataGridFilterFieldOption[];
  /** Async option fetcher for lookup fields with large option sets */
  onSearchOptions?: (query: string) => Promise<DataGridFilterFieldOption[]>;
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

  /** Active filter chips displayed above the table (legacy dropdown pattern) */
  activeFilters?: DataGridFilter[];
  /** Called when a single filter chip is removed (legacy) */
  onFilterRemove?: (key: string) => void;
  /** Called when "Clear all" filters is clicked (legacy) */
  onFiltersClear?: () => void;

  /** Field definitions for the filter builder popover (new chip pattern) */
  filterFields?: DataGridFilterField[];
  /** Structured filter state — FilterExpression[] (new chip pattern) */
  filters?: FilterExpression[];
  /** Called when a filter is added via the filter builder */
  onFilterAdd?: (expr: FilterExpression) => void;
  /** Called when a structured filter is removed by field key */
  onStructuredFilterRemove?: (field: string) => void;
  /** Called when a structured filter is updated at an index */
  onFilterUpdate?: (index: number, expr: FilterExpression) => void;
  /** Called to clear all structured filters */
  onStructuredFiltersClear?: () => void;

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

  /** Default column visibility when no user preference is stored. Keys are column IDs, values are booleans. */
  defaultColumnVisibility?: Record<string, boolean>;

  /** Render function for mobile card view. If omitted, table is used on all screen sizes. */
  renderCard?: (row: TData) => ReactNode;

  /** Additional actions rendered in the toolbar (e.g., "Add" button) */
  toolbarActions?: ReactNode;

  /** Optional callback to add CSS classes to table rows based on row data */
  rowClassName?: (row: TData) => string | undefined;

  /**
   * Optional callback to add HTML attributes (e.g. `data-status`) to each
   * `<tr>` element based on row data. Useful for theme-driven row tinting
   * (the Instrument theme reads `data-status` to paint filed/due-soon/overdue
   * row washes).
   */
  rowAttributes?: (row: TData) => Record<string, string | undefined> | undefined;

  /** Enable export button in toolbar. Exports visible columns from current page data. */
  enableExport?: boolean;
  /** Filename prefix for exported files (without extension). Defaults to 'export'. */
  exportFilename?: string;
}

export interface DataGridExportColumn {
  id: string;
  header: string;
}
