import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { CategoryService } from '@packages/taxonomy';
import { categoryGroups } from '@packages/taxonomy/schema';
import { eq } from 'drizzle-orm';

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

@Injectable()
export class CountriesSeedService implements OnApplicationBootstrap {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly categoryService: CategoryService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(CountriesSeedService.name);
  }

  async onApplicationBootstrap() {
    await this.ensureCountries();
  }

  private async ensureCountries() {
    const [existing] = await this.database.db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.slug, COUNTRIES_GROUP_SLUG))
      .limit(1);

    if (existing) return;

    const group = await this.categoryService.createCategoryGroup({
      name: 'Countries',
      slug: COUNTRIES_GROUP_SLUG,
      description: 'Standard country list for address fields',
    });

    for (let i = 0; i < COUNTRIES.length; i++) {
      await this.categoryService.createCategory({
        groupId: group.id,
        name: COUNTRIES[i],
        slug: toSlug(COUNTRIES[i]),
        sortOrder: i,
      });
    }

    this.logger.log(`Created countries category group with ${COUNTRIES.length} entries`);
  }
}
