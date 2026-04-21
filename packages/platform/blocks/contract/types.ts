/**
 * Section data-source — where a rendered section pulls its records from.
 *
 * - `static`: no external records; the block renders purely from author-entered
 *   `customFields`. Hero, Text, CTA etc. use this.
 * - `entity-query`: run a list query against the named entity (filter/sort/limit).
 *   Used by content blocks (Testimonials, FAQ, etc.) that want "top N active".
 * - `entity-ids`: caller hand-picks specific record IDs, in order. Used when an
 *   author wants to feature three specific team members.
 */
export type DataSource =
  | { kind: 'static' }
  | {
      kind: 'entity-query';
      entity: string;
      filter?: Record<string, unknown>;
      sort?: string;
      limit?: number;
    }
  | { kind: 'entity-ids'; entity: string; ids: string[] };

/**
 * Shape of a rendered page section as the public-page API returns it and the
 * PageRenderer consumes it. `data` is the mapper output (pre-resolved on the
 * server), `customFields` is author-entered block config, `title` is the
 * optional section heading. Blocks receive a merged prop bag composed from
 * these three plus `variant`.
 */
export interface SectionData {
  id: string;
  order: number;
  blockKind: string;
  variant: string | null;
  title: string | null;
  customFields: Record<string, unknown>;
  data: Record<string, unknown>;
}

/**
 * Pure function mapping raw entity records to the block's typed prop shape.
 * Lives in the contract (no React) so the API layer can run it while
 * assembling the public-page response — blocks stay stateless on the client.
 */
export interface MapperDefinition<
  TRecord = unknown,
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Entity slug the mapper reads from (matches defineEntity `slug`). */
  entity: string;
  /** Block kind the mapper targets. */
  block: string;
  /** Transform records → block props. */
  map: (records: TRecord[]) => TProps;
}
