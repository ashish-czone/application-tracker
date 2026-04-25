import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, users } from '@packages/database';
import { pages, sections } from '../pages/schema';
import { eq } from 'drizzle-orm';

const DEMO_SLUG = 'home-content';

interface SectionSeed {
  order: number;
  blockKind: string;
  title: string | null;
  customFields: Record<string, unknown>;
  dataSource: {
    kind: 'entity-query';
    entity: string;
    sort?: string;
    limit: number;
  };
}

const SECTIONS: SectionSeed[] = [
  {
    order: 0,
    blockKind: 'value-props-grid',
    title: 'Why teams choose us',
    customFields: {
      subheading: 'Four reasons the switch pays for itself in the first quarter.',
    },
    dataSource: { kind: 'entity-query', entity: 'value-props', sort: 'displayOrder', limit: 4 },
  },
  {
    order: 1,
    blockKind: 'stats-row',
    title: null,
    customFields: {},
    dataSource: { kind: 'entity-query', entity: 'stats', sort: 'displayOrder', limit: 4 },
  },
  {
    order: 2,
    blockKind: 'services-grid',
    title: 'Services',
    customFields: {
      subheading: 'From migration to ongoing operations — choose where you need a hand.',
    },
    dataSource: { kind: 'entity-query', entity: 'services', sort: 'displayOrder', limit: 6 },
  },
  {
    order: 3,
    blockKind: 'testimonials-grid',
    title: 'What customers say',
    customFields: {},
    dataSource: { kind: 'entity-query', entity: 'testimonials', sort: 'displayOrder', limit: 3 },
  },
  {
    order: 4,
    blockKind: 'client-logos-row',
    title: 'Trusted by teams at',
    customFields: {},
    dataSource: { kind: 'entity-query', entity: 'client-logos', sort: 'displayOrder', limit: 10 },
  },
  {
    order: 5,
    blockKind: 'team-grid',
    title: 'The team',
    customFields: {
      subheading: 'A small crew of operators and engineers. We pick up the phone.',
    },
    dataSource: { kind: 'entity-query', entity: 'team-members', sort: 'displayOrder', limit: 8 },
  },
  {
    order: 6,
    blockKind: 'faq-accordion',
    title: 'Frequently asked',
    customFields: {},
    dataSource: { kind: 'entity-query', entity: 'faq-items', sort: 'displayOrder', limit: 10 },
  },
];

/**
 * Seeds a single demo page at `/home-content` whose sections each pull from
 * one content entity via `entity-query`. Idempotent — skipped entirely if the
 * page already exists. Complements `demo-content.ts`: that seed populates the
 * records, this one wires them into a renderable page so `GET
 * /public/pages/home-content` returns a fully resolved response from the
 * moment the demo data is in place.
 */
export const seedDemoPage = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  const [existing] = await database.db
    .select({ id: pages.id })
    .from(pages)
    .where(eq(pages.slug, DEMO_SLUG))
    .limit(1);
  if (existing) return;

  const [page] = await database.db
    .insert(pages)
    .values({
      slug: DEMO_SLUG,
      title: 'Home — Content showcase',
      metaDescription:
        'Demo page wiring every content-block kind to the matching demo entity records. Edit sections in the admin to change the layout.',
      createdBy: admin.id,
    })
    .returning({ id: pages.id });

  for (const s of SECTIONS) {
    await database.db.insert(sections).values({
      pageId: page.id,
      order: s.order,
      blockKind: s.blockKind,
      title: s.title,
      customFields: s.customFields,
      dataSource: s.dataSource,
    });
  }
};
