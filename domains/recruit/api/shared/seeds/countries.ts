import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { CategoryService } from '@packages/taxonomy';
import { categoryGroups } from '@packages/taxonomy/schema';

const COUNTRIES_GROUP_SLUG = 'countries';

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia',
  'Austria', 'Bahrain', 'Bangladesh', 'Belgium', 'Brazil',
  'Canada', 'Chile', 'China', 'Colombia', 'Czech Republic',
  'Denmark', 'Egypt', 'Finland', 'France', 'Germany',
  'Greece', 'Hong Kong', 'Hungary', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Japan', 'Jordan', 'Kenya', 'Kuwait', 'Lebanon',
  'Malaysia', 'Mexico', 'Morocco', 'Netherlands', 'New Zealand',
  'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
  'Russia', 'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea',
  'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan',
  'Thailand', 'Turkey', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Vietnam',
];

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const seedCountries = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const categoryService = ctx.get(CategoryService);

  const [existing] = await database.db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.slug, COUNTRIES_GROUP_SLUG))
    .limit(1);

  if (existing) return;

  const group = await categoryService.createCategoryGroup({
    name: 'Countries',
    slug: COUNTRIES_GROUP_SLUG,
    description: 'Standard country list for address fields',
  });

  for (let i = 0; i < COUNTRIES.length; i++) {
    await categoryService.createCategory({
      groupId: group.id,
      name: COUNTRIES[i],
      slug: toSlug(COUNTRIES[i]),
      sortOrder: i,
    });
  }
};
