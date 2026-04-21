import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, and, asc, eq, isNull, inArray } from '@packages/database';
import { EntityRegistryService, type EntityService } from '@packages/entity-engine';
import { mapperRegistry, type DataSource } from '@packages/blocks-contract';
import { pages } from '../schema/pages';
import { sections } from '../schema/sections';

export interface PublicSectionDto {
  id: string;
  order: number;
  blockKind: string;
  variant: string | null;
  title: string | null;
  customFields: Record<string, unknown>;
  data: Record<string, unknown>;
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

interface SectionRow {
  id: string;
  order: number;
  blockKind: string;
  variant: string | null;
  title: string | null;
  dataSource: DataSource | null;
  customFields: Record<string, unknown> | null;
}

@Injectable()
export class PagesPublicService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly moduleRef: ModuleRef,
    private readonly entityRegistry: EntityRegistryService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(PagesPublicService.name);
  }

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
        title: sections.title,
        dataSource: sections.dataSource,
        customFields: sections.customFields,
      })
      .from(sections)
      .where(eq(sections.pageId, page.id))
      .orderBy(asc(sections.order));

    const resolved = await Promise.all(
      rows.map((row) =>
        this.resolveSection({
          ...row,
          customFields: (row.customFields ?? null) as Record<string, unknown> | null,
        }),
      ),
    );

    return { page, sections: resolved };
  }

  /**
   * Resolves one section into its public DTO. Pulls records from the entity
   * engine if the section declares an `entity-query` / `entity-ids` data
   * source, runs the registered mapper for `(entity, blockKind)`, and attaches
   * the mapped props as `data`. Missing mapper or failed resolution degrades
   * gracefully — the section still renders, with `data = {}`, so a stale
   * config never brings the whole page down.
   */
  private async resolveSection(row: SectionRow): Promise<PublicSectionDto> {
    const customFields = (row.customFields ?? {}) as Record<string, unknown>;
    const base = {
      id: row.id,
      order: row.order,
      blockKind: row.blockKind,
      variant: row.variant,
      title: row.title,
      customFields,
    };

    const ds = row.dataSource;
    if (!ds || ds.kind === 'static') {
      return { ...base, data: {} };
    }

    try {
      const records = await this.fetchRecords(ds);
      const mapper = mapperRegistry.get(ds.entity, row.blockKind);
      if (!mapper) {
        this.logger.warn(
          `No mapper registered for (entity=${ds.entity}, block=${row.blockKind}); section ${row.id} will render with empty data`,
        );
        return { ...base, data: {} };
      }
      return { ...base, data: mapper.map(records) };
    } catch (err) {
      this.logger.error(
        `Failed to resolve data source for section ${row.id} (entity=${ds.entity}, block=${row.blockKind})`,
        undefined,
        err instanceof Error ? err.stack : String(err),
      );
      return { ...base, data: {} };
    }
  }

  /**
   * Fetches raw records for a data source. For `entity-query`, runs the
   * engine's generic list with filter/sort/limit. For `entity-ids`, uses the
   * same list path with an `id` filter and preserves the caller's ordering.
   */
  private async fetchRecords(ds: Exclude<DataSource, { kind: 'static' }>): Promise<unknown[]> {
    const entityType = this.resolveEntityType(ds.entity);
    const service = this.getEntityService(entityType);
    if (!service) {
      this.logger.warn(`No entity service found for '${ds.entity}' (resolved type '${entityType}')`);
      return [];
    }

    if (ds.kind === 'entity-ids') {
      if (ds.ids.length === 0) return [];
      const filters = JSON.stringify([{ field: 'id', operator: 'in', value: ds.ids }]);
      const resp = await service.list({ limit: ds.ids.length, filters } as never);
      const byId = new Map<string, unknown>();
      for (const record of resp.data) {
        const idValue = (record as { id?: unknown }).id;
        if (typeof idValue === 'string') byId.set(idValue, record);
      }
      return ds.ids.map((id) => byId.get(id)).filter((r): r is unknown => r !== undefined);
    }

    // entity-query
    const [sortKey, order] = this.parseSort(ds.sort);
    const query = {
      ...(ds.filter ?? {}),
      limit: ds.limit ?? 10,
      ...(sortKey ? { sort: sortKey, order } : {}),
    } as never;
    const resp = await service.list(query);
    return resp.data;
  }

  /**
   * Resolves a data-source `entity` string (the addon-facing slug) to the
   * entity-engine's internal `entityType` used in service tokens. Falls back
   * to the raw string if it's already a registered entityType.
   */
  private resolveEntityType(entity: string): string {
    const bySlug = this.entityRegistry.getBySlug(entity);
    if (bySlug) return bySlug.entityType;
    const byType = this.entityRegistry.get(entity);
    if (byType) return byType.entityType;
    return entity;
  }

  /**
   * Parses a `sort` clause of the form `"-createdAt"` (desc) or `"createdAt"`
   * (asc) into the `{ sort, order }` pair that `EntityService.list` expects.
   */
  private parseSort(sort: string | undefined): [string | undefined, 'asc' | 'desc'] {
    if (!sort) return [undefined, 'asc'];
    if (sort.startsWith('-')) return [sort.slice(1), 'desc'];
    return [sort, 'asc'];
  }

  private getEntityService(entityType: string): EntityService | null {
    try {
      return this.moduleRef.get<EntityService>(`ENTITY_SERVICE_${entityType}`, { strict: false });
    } catch {
      return null;
    }
  }

  /**
   * Resolve a set of page ids to their public slugs. Used by other addons
   * (e.g. menus) that store a pageId reference and need to render a URL
   * without crossing into the pages schema directly.
   */
  async getSlugsForIds(ids: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (ids.length === 0) return result;
    const unique = Array.from(new Set(ids));
    const rows = await this.database.db
      .select({ id: pages.id, slug: pages.slug })
      .from(pages)
      .where(and(inArray(pages.id, unique), isNull(pages.deletedAt)));
    for (const row of rows) result.set(row.id, row.slug);
    return result;
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
