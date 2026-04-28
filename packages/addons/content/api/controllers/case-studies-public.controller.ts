import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@packages/auth-core';
import { eq, and, isNull } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { caseStudies } from '../schema/case-studies';

export interface PublicCaseStudy {
  id: string;
  title: string;
  slug: string;
  client: string;
  industry: string | null;
  year: number | null;
  summary: string;
  body: string | null;
  results: string | null;
  heroImageUrl: string | null;
  ctaText: string | null;
  ctaHref: string | null;
  displayOrder: number;
  publishedAt: string | null;
}

/**
 * Public read API for case studies. Filters out soft-deleted rows and
 * inactive ones; the customer site uses these endpoints to drive the
 * /work listing page and /work/[slug] detail pages.
 */
@ApiTags('case-studies')
@Controller()
export class CaseStudiesPublicController {
  constructor(private readonly database: DatabaseService) {}

  @Public()
  @Get('public/case-studies')
  @ApiOperation({ summary: 'List active case studies (unauthenticated)' })
  async list(@Query('industry') industry?: string): Promise<{ items: PublicCaseStudy[] }> {
    const conditions = [isNull(caseStudies.deletedAt), eq(caseStudies.isActive, true)];
    if (industry) conditions.push(eq(caseStudies.industry, industry));
    const rows = await this.database.db
      .select()
      .from(caseStudies)
      .where(and(...conditions))
      .orderBy(caseStudies.displayOrder);
    return { items: rows.map(toPublic) };
  }

  @Public()
  @Get('public/case-studies/:slug')
  @ApiOperation({ summary: 'Fetch a single case study by slug (unauthenticated)' })
  async findBySlug(@Param('slug') slug: string): Promise<PublicCaseStudy> {
    const [row] = await this.database.db
      .select()
      .from(caseStudies)
      .where(
        and(
          eq(caseStudies.slug, slug),
          eq(caseStudies.isActive, true),
          isNull(caseStudies.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`No case study with slug '${slug}'`);
    return toPublic(row);
  }
}

function toPublic(row: typeof caseStudies.$inferSelect): PublicCaseStudy {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    client: row.client,
    industry: row.industry,
    year: row.year,
    summary: row.summary,
    body: row.body,
    results: row.results,
    heroImageUrl: row.heroImageUrl,
    ctaText: row.ctaText,
    ctaHref: row.ctaHref,
    displayOrder: row.displayOrder,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}
