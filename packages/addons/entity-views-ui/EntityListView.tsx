import { useMemo } from 'react';
import { DataGrid, useDataGridParams, type ColumnDef } from '@packages/ui';
import { useEntityListViewContext } from './EntityListViewProvider';
import type { ListLayoutDefinition, ListColumnDefinition } from './define-list-layout';

/**
 * Standardised hook signature for list data fetching. Consumer-provided
 * hooks (e.g. `useRulesList`) implement this shape via TanStack Query.
 */
export interface UseListResult<TRow> {
  data: TRow[] | undefined;
  meta: { page: number; limit: number; total: number } | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export interface UseListQuery {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export type UseListHook<TRow> = (query: UseListQuery) => UseListResult<TRow>;

interface EntityListViewProps<TRow> {
  /** Layout definition produced by `defineListLayout()`. */
  layout: ListLayoutDefinition<TRow>;
  /**
   * Consumer-provided hook that fetches list data. The hook receives the
   * current page/limit/sort/order/search state (synced to URL via
   * `useDataGridParams`) and returns standard TanStack Query state.
   */
  useList: UseListHook<TRow>;
}

/**
 * Generic list view that consumes a `defineListLayout` config + a typed
 * `useList` hook and renders via `<DataGrid>`. URL sync, pagination, sort,
 * and search are wired through `useDataGridParams`. Cells are resolved
 * via the renderer registry on `<EntityListViewProvider>`.
 *
 * @example
 *   const RULES_LAYOUT = defineListLayout<ComplianceRule>({ ... });
 *
 *   function RulesListPage() {
 *     return <EntityListView layout={RULES_LAYOUT} useList={useRulesList} />;
 *   }
 */
export function EntityListView<TRow>({
  layout,
  useList,
}: EntityListViewProps<TRow>) {
  const { cellRenderers } = useEntityListViewContext();

  const { page, pageSize, search, sort, order, setPage, setPageSize, setSearch, setSort } =
    useDataGridParams({
      defaultSort: layout.defaultSort?.field,
      defaultOrder: layout.defaultSort?.order ?? 'desc',
      defaultPageSize: layout.defaultPageSize ?? 25,
      storageKey: `${layout.entity}-list`,
    });

  const result = useList({ page, limit: pageSize, sort: sort || undefined, order, search: search || undefined });

  const columns = useMemo<ColumnDef<TRow, unknown>[]>(() => {
    return layout.columns.map((col) =>
      buildColumnDef(
        col,
        cellRenderers as Record<string, React.ComponentType<{ value: unknown; row: unknown; column: ListColumnDefinition<unknown> }>>,
      ),
    );
  }, [layout.columns, cellRenderers]);

  const totalRows = result.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <DataGrid<TRow>
      columns={columns}
      data={result.data ?? []}
      page={page}
      pageSize={pageSize}
      pageCount={pageCount}
      totalRows={totalRows}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      sortColumn={sort || undefined}
      sortDirection={order}
      onSortChange={setSort}
      search={search}
      onSearchChange={setSearch}
      isLoading={result.isLoading}
      isError={result.isError}
    />
  );
}

/**
 * Build a TanStack Table ColumnDef from a layout column + renderer registry.
 * Falls back to the `text` renderer if the named cell isn't registered (with
 * a console warning so the missing renderer surfaces in dev).
 */
function buildColumnDef<TRow>(
  col: ListColumnDefinition<TRow>,
  renderers: Record<string, React.ComponentType<{ value: unknown; row: unknown; column: ListColumnDefinition<unknown> }>>,
): ColumnDef<TRow, unknown> {
  const cellName = col.cell ?? 'text';
  const Renderer = renderers[cellName] ?? renderers.text;

  if (!renderers[cellName] && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      `EntityListView: cell renderer '${cellName}' for column '${col.field}' not found in registry — falling back to 'text'`,
    );
  }

  return {
    id: col.field as string,
    accessorFn: (row: TRow) => (row as Record<string, unknown>)[col.field as string],
    header: col.label,
    enableSorting: col.sortable ?? false,
    size: col.width,
    cell: ({ row, getValue }) => (
      <Renderer value={getValue()} row={row.original} column={col as ListColumnDefinition<unknown>} />
    ),
  };
}
