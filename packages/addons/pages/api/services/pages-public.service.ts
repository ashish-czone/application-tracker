import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService, and, asc, eq, isNull, inArray, sql } from '@packages/database';
import { pages } from '../schema/pages';
import { sections } from '../schema/sections';

export interface PublicSectionDto {
  id: string;
  order: number;
  blockKind: string;
  variant: string | null;
  customFields: Record<string, unknown>;
}

export interface PublicPageDto {
  id: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  ogImage: string | null;
}

export interface PublicPageResponse {
  page: PublicPageDto;
  sections: PublicSectionDto[];
}

@Injectable()
export class PagesPublicService {
  constructor(private readonly database: DatabaseService) {}

  async getBySlug(slug: string): Promise<PublicPageResponse> {
    const [page] = await this.database.db
      .select({
        id: pages.id,
        slug: pages.slug,
        title: pages.title,
        metaDescription: pages.metaDescription,
        ogImage: pages.ogImage,
      })
      .from(pages)
      .where(and(eq(pages.slug, slug), isNull(pages.deletedAt)))
      .limit(1);

    if (!page) {
      throw new NotFoundException(`No published page with slug '${slug}'`);
    }

    const rows = await this.database.db
      .select({
        id: sections.id,
        order: sections.order,
        blockKind: sections.blockKind,
        variant: sections.variant,
        customFields: sections.customFields,
      })
      .from(sections)
      .where(eq(sections.pageId, page.id))
      .orderBy(asc(sections.order));

    return {
      page,
      sections: rows.map((r) => ({
        ...r,
        customFields: (r.customFields ?? {}) as Record<string, unknown>,
      })),
    };
  }

  async reorder(pageId: string, orders: { id: string; order: number }[]): Promise<void> {
    const ids = orders.map((o) => o.id);
    const existing = await this.database.db
      .select({ id: sections.id, pageId: sections.pageId })
      .from(sections)
      .where(inArray(sections.id, ids));

    if (existing.length !== ids.length) {
      throw new NotFoundException('One or more sections do not exist');
    }
    const foreign = existing.filter((s) => s.pageId !== pageId);
    if (foreign.length > 0) {
      throw new BadRequestException(
        `Sections ${foreign.map((s) => s.id).join(', ')} do not belong to page ${pageId}`,
      );
    }

    await this.database.db.transaction(async (tx) => {
      for (const { id, order } of orders) {
        await tx.update(sections).set({ order }).where(eq(sections.id, id));
      }
    });
  }
}
