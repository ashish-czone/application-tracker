/**
 * Frontend layout config for an entity detail / edit view. The shape is
 * sketched here for parallelism with `defineListLayout`, but the matching
 * `<EntityDetailView>` component is intentionally NOT built in v1 — detail
 * pages are typically more bespoke than list pages and benefit less from a
 * generic component. Sprint 2 (rules pilot) revisits this once a real
 * detail page tries to consume the layout.
 */

export interface DetailLayoutSection<TRow> {
  /** Section title shown in the form. */
  title: string;
  /** Fields rendered in the section, in order. */
  fields: (keyof TRow & string)[];
  /** Optional collapsible state default (true = collapsed by default). */
  collapsedByDefault?: boolean;
}

export interface DetailLayoutDefinition<TRow> {
  /** Entity slug. */
  entity: string;
  /** Sections in display order. */
  sections: DetailLayoutSection<TRow>[];
}

/**
 * Type-only factory for declaring a detail layout. Returns the input
 * unchanged (after type-checking). Component consumer (`<EntityDetailView>`)
 * is not yet built — see file header.
 */
export function defineDetailLayout<TRow>(
  definition: DetailLayoutDefinition<TRow>,
): DetailLayoutDefinition<TRow> {
  return definition;
}
