/**
 * Frontend layout config for an entity list view. Replaces the
 * `/<entity>/layout/list` endpoint that the entity-engine generates from
 * `defineEntity` field metadata. Each list page declares its own layout
 * statically — no backend round-trip, no risk of stale layout shipped to
 * clients while the server has new fields.
 *
 * The `cell` key is a string name resolved against the
 * `EntityListViewProvider`'s renderer registry. Built-in renderers shipped
 * with this package: `text`, `lookup`, `workflow`. Apps register custom
 * renderers via the provider.
 */

export type ListColumnAlign = 'left' | 'center' | 'right';

export interface ListColumnLookupConfig {
  /** Entity slug to fetch labels from, e.g. 'laws'. */
  entity: string;
  /** Field on the lookup entity to use as the display label, e.g. 'name'. */
  labelField: string;
  /** Optional: field used as a secondary subtitle in the cell. */
  subtitleField?: string;
}

export interface ListColumnDefinition<TRow> {
  /** Field on the row to read. Typed against the row shape. */
  field: keyof TRow & string;
  /** Display label for the column header. */
  label: string;
  /** Renderer name (resolved via `EntityListViewProvider`). Defaults to 'text'. */
  cell?: string;
  /** Whether this column participates in server-side search. */
  searchable?: boolean;
  /** Whether this column can be sorted via the table header click. */
  sortable?: boolean;
  /** Pixel width hint (passed to TanStack Table size). */
  width?: number;
  /** Cell text alignment. Defaults to 'left'. */
  align?: ListColumnAlign;
  /** Marks this column as the entity's natural label (used for breadcrumbs, picker chips). */
  isLabel?: boolean;
  /** Lookup config (required when `cell: 'lookup'`). */
  lookup?: ListColumnLookupConfig;
  /** Workflow slug (required when `cell: 'workflow'`). */
  workflowSlug?: string;
  /** Free-form metadata for app-specific renderers. */
  meta?: Record<string, unknown>;
}

export interface ListLayoutDefinition<TRow> {
  /** Entity slug, e.g. 'compliance-rules'. Used for storage keys + telemetry. */
  entity: string;
  /** Default sort column + direction. */
  defaultSort?: { field: keyof TRow & string; order: 'asc' | 'desc' };
  /** Columns in display order. */
  columns: ListColumnDefinition<TRow>[];
  /** Default page size. Falls back to 25 when omitted. */
  defaultPageSize?: number;
}

/**
 * Type-only factory for declaring a list layout. Returns the input
 * unchanged (after type-checking). Pair with `<EntityListView>` to render.
 *
 * @example
 *   import { defineListLayout } from '@packages/entity-layout-ui';
 *   import type { ComplianceRule } from '@domains/compliance-contract';
 *
 *   export const RULES_LIST_LAYOUT = defineListLayout<ComplianceRule>({
 *     entity: 'compliance-rules',
 *     defaultSort: { field: 'code', order: 'asc' },
 *     columns: [
 *       { field: 'code',      label: 'Code',      cell: 'text',     searchable: true, sortable: true, width: 120 },
 *       { field: 'name',      label: 'Name',      cell: 'text',     searchable: true, sortable: true, isLabel: true },
 *       { field: 'lawId',     label: 'Law',       cell: 'lookup',   lookup: { entity: 'laws', labelField: 'name' } },
 *       { field: 'status',    label: 'Status',    cell: 'workflow', workflowSlug: 'compliance-rule-status' },
 *     ],
 *   });
 */
export function defineListLayout<TRow>(
  definition: ListLayoutDefinition<TRow>,
): ListLayoutDefinition<TRow> {
  return definition;
}
