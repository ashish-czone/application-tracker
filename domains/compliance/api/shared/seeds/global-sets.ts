import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { CategoryService } from '@packages/taxonomy';
import { categoryGroups } from '@packages/taxonomy/schema';

interface GlobalSetItemSeed {
  slug: string;
  name: string;
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
      { slug: 'IN', name: 'India' },
      { slug: 'US', name: 'United States' },
      { slug: 'GB', name: 'United Kingdom' },
      { slug: 'AE', name: 'United Arab Emirates' },
      { slug: 'SG', name: 'Singapore' },
      { slug: 'DE', name: 'Germany' },
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
      { slug: 'INR', name: 'Indian Rupee' },
      { slug: 'USD', name: 'US Dollar' },
      { slug: 'EUR', name: 'Euro' },
      { slug: 'GBP', name: 'Pound Sterling' },
      { slug: 'AED', name: 'UAE Dirham' },
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

  if (existing) return;

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
      });
    }
  }
}
