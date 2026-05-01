import type { ComponentType } from 'react';
import type { ListColumnDefinition } from '../define-list-layout';

/**
 * Props every cell renderer receives. The component is mounted once per
 * (column × visible row); renderers should be pure projections of value +
 * column config (avoid heavy per-cell side effects).
 */
export interface CellRendererProps<TRow = Record<string, unknown>> {
  /** The row's raw value for the column's field. */
  value: unknown;
  /** The full row (for renderers that combine multiple fields). */
  row: TRow;
  /** The column definition (needed for renderer-specific config like `lookup` or `workflowSlug`). */
  column: ListColumnDefinition<TRow>;
}

/**
 * Cell renderer — a React component receiving the cell's value and row,
 * returning the rendered cell content.
 */
export type CellRenderer<TRow = Record<string, unknown>> =
  ComponentType<CellRendererProps<TRow>>;

/**
 * Registry of cell renderers keyed by name. The name is referenced by
 * `column.cell` in the layout definition. Apps populate the registry via
 * `<EntityListViewProvider cellRenderers={...}>`.
 */
export type CellRendererRegistry = Record<string, CellRenderer>;
