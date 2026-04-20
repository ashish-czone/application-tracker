import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, and, eq, isNull } from '@packages/database';
import { CategoryService } from '@packages/taxonomy';
import { categories, categoryGroups } from '@packages/taxonomy/schema';

interface GlobalSetItemSeed {
  slug: string;
  name: string;
  metadata?: Record<string, string>;
  children?: GlobalSetItemSeed[];
}

interface GlobalSetGroupSeed {
  slug: string;
  name: string;
  description: string;
  items: GlobalSetItemSeed[];
}

const GLOBAL_SETS: GlobalSetGroupSeed[] = [
  {
    slug: 'countries',
    name: 'Countries',
    description: 'ISO 3166-1 country list. Used on client, user and jurisdiction fields.',
    items: [
      { slug: 'IN', name: 'India', metadata: { iso3: 'IND', phone: '+91' } },
      { slug: 'US', name: 'United States', metadata: { iso3: 'USA', phone: '+1' } },
      { slug: 'GB', name: 'United Kingdom', metadata: { iso3: 'GBR', phone: '+44' } },
      { slug: 'AE', name: 'United Arab Emirates', metadata: { iso3: 'ARE', phone: '+971' } },
      { slug: 'SG', name: 'Singapore', metadata: { iso3: 'SGP', phone: '+65' } },
      { slug: 'DE', name: 'Germany', metadata: { iso3: 'DEU', phone: '+49' } },
    ],
  },
  {
    slug: 'industries',
    name: 'Industries',
    description: 'Two-level sector classification based on NIC codes.',
    items: [
      {
        slug: 'financial-services',
        name: 'Financial Services',
        children: [
          { slug: 'banking', name: 'Banking' },
          { slug: 'insurance', name: 'Insurance' },
          { slug: 'nbfc', name: 'NBFC' },
        ],
      },
      {
        slug: 'manufacturing',
        name: 'Manufacturing',
        children: [
          { slug: 'automotive', name: 'Automotive' },
          { slug: 'pharmaceuticals', name: 'Pharmaceuticals' },
        ],
      },
      {
        slug: 'technology',
        name: 'Technology',
        children: [{ slug: 'saas', name: 'SaaS' }],
      },
    ],
  },
  {
    slug: 'currencies',
    name: 'Currencies',
    description: 'ISO 4217 currencies with symbol and minor units.',
    items: [
      { slug: 'INR', name: 'Indian Rupee', metadata: { symbol: '₹', minor: '2' } },
      { slug: 'USD', name: 'US Dollar', metadata: { symbol: '$', minor: '2' } },
      { slug: 'EUR', name: 'Euro', metadata: { symbol: '€', minor: '2' } },
      { slug: 'GBP', name: 'Pound Sterling', metadata: { symbol: '£', minor: '2' } },
      { slug: 'AED', name: 'UAE Dirham', metadata: { symbol: 'د.إ', minor: '2' } },
    ],
  },
  {
    slug: 'languages',
    name: 'Languages',
    description: 'Supported UI and correspondence languages.',
    items: [
      { slug: 'en', name: 'English' },
      { slug: 'hi', name: 'Hindi' },
      { slug: 'ar', name: 'Arabic' },
      { slug: 'fr', name: 'French' },
    ],
  },
  {
    slug: 'jurisdictions',
    name: 'Jurisdictions',
    description: 'Central, state and municipal regulatory jurisdictions.',
    items: [
      {
        slug: 'central',
        name: 'Central',
        children: [
          { slug: 'mca', name: 'Ministry of Corporate Affairs' },
          { slug: 'sebi', name: 'SEBI' },
          { slug: 'rbi', name: 'RBI' },
        ],
      },
      {
        slug: 'state',
        name: 'State',
        children: [
          { slug: 'mh', name: 'Maharashtra' },
          { slug: 'ka', name: 'Karnataka' },
        ],
      },
      { slug: 'municipal', name: 'Municipal' },
    ],
  },
];

export const seedGlobalSets = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const categoryService = ctx.get(CategoryService);

  for (const set of GLOBAL_SETS) {
    await ensureGlobalSet(database, categoryService, set);
  }
};

async function ensureGlobalSet(
  database: DatabaseService,
  categoryService: CategoryService,
  set: GlobalSetGroupSeed,
): Promise<void> {
  const [existing] = await database.db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.slug, set.slug))
    .limit(1);

  if (existing) {
    await backfillMetadata(database, categoryService, existing.id, set.items);
    return;
  }

  const group = await categoryService.createCategoryGroup({
    name: set.name,
    slug: set.slug,
    description: set.description,
  });

  for (let i = 0; i < set.items.length; i++) {
    const item = set.items[i];
    const parent = await categoryService.createCategory({
      groupId: group.id,
      name: item.name,
      slug: item.slug,
      sortOrder: i,
      metadata: item.metadata,
    });

    if (!item.children) continue;

    for (let j = 0; j < item.children.length; j++) {
      const child = item.children[j];
      await categoryService.createCategory({
        groupId: group.id,
        parentId: parent.id,
        name: child.name,
        slug: child.slug,
        sortOrder: j,
        metadata: child.metadata,
      });
    }
  }
}

async function backfillMetadata(
  database: DatabaseService,
  categoryService: CategoryService,
  groupId: string,
  items: GlobalSetItemSeed[],
  parentId: string | null = null,
): Promise<void> {
  for (const item of items) {
    const [row] = await database.db
      .select({ id: categories.id, metadata: categories.metadata })
      .from(categories)
      .where(
        and(
          eq(categories.groupId, groupId),
          eq(categories.slug, item.slug),
          parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId),
        ),
      )
      .limit(1);

    if (!row) continue;

    if (item.metadata && Object.keys(row.metadata ?? {}).length === 0) {
      await categoryService.updateCategory(row.id, { metadata: item.metadata });
    }

    if (item.children) {
      await backfillMetadata(database, categoryService, groupId, item.children, row.id);
    }
  }
}
