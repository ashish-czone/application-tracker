import { defineMapper } from '../registry';

export interface CaseStudyRecord {
  id: string;
  title: string;
  slug: string;
  client: string;
  industry: string | null;
  year: number | null;
  summary: string;
  heroImageUrl: string | null;
}

export interface CaseStudyGridEntries extends Record<string, unknown> {
  /**
   * Mapped entries for the case-study-grid block. The block's static
   * `fields.entries` text field stays as-is for hand-authored grids;
   * when this `entries` array is supplied via the data-source path it
   * takes precedence (the block reads `data.entries` first, then falls
   * back to parsing `fields.entries`).
   */
  entries: Array<{
    client: string;
    title: string;
    href: string;
    imageUrl: string;
    industry: string | null;
    year: number | null;
  }>;
}

export const caseStudyGridMapper = defineMapper<CaseStudyRecord, CaseStudyGridEntries>({
  entity: 'case-studies',
  block: 'case-study-grid',
  map: (records) => ({
    entries: records.map((r) => ({
      client: r.client,
      title: r.title,
      // Customer site detail route. Kept here (not on the entity) so the
      // mapper owns URL shape — entities stay UI-agnostic.
      href: `/work/${r.slug}`,
      imageUrl: r.heroImageUrl ?? '',
      industry: r.industry,
      year: r.year,
    })),
  }),
});
