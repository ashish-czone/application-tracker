import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, and, asc, eq, isNull } from '@packages/database';
import { PagesPublicService } from '@packages/pages-api';
import { menus } from '../schema/menus';
import { menuItems } from '../schema/menu-items';

export interface PublicMenuItemDto {
  id: string;
  label: string;
  linkType: 'url' | 'page';
  url: string | null;
  pageId: string | null;
  /**
   * Ready-to-render href. `url` is passed through as-is; `page` is resolved
   * to `/<pageSlug>` using PagesPublicService. `null` when the reference is
   * dangling (the target page was deleted).
   */
  href: string | null;
  target: '_self' | '_blank';
  depth: number;
  sortOrder: number;
  children: PublicMenuItemDto[];
}

export interface PublicMenuResponse {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  items: PublicMenuItemDto[];
}

/**
 * Anonymous read API for the customer portal. Returns a menu by slug with
 * its items assembled into a 2-level tree, sorted by sort_order within each
 * parent. Soft-deleted menus and items are excluded.
 */
@Injectable()
export class MenusPublicService {
  constructor(
    private readonly database: DatabaseService,
    private readonly pagesPublic: PagesPublicService,
  ) {}

  async getBySlug(slug: string): Promise<PublicMenuResponse> {
    const [menu] = await this.database.db
      .select({
        id: menus.id,
        slug: menus.slug,
        name: menus.name,
        description: menus.description,
      })
      .from(menus)
      .where(and(eq(menus.slug, slug), isNull(menus.deletedAt)))
      .limit(1);

    if (!menu) {
      throw new NotFoundException(`No menu with slug '${slug}'`);
    }

    const rows = await this.database.db
      .select({
        id: menuItems.id,
        label: menuItems.label,
        linkType: menuItems.linkType,
        url: menuItems.url,
        pageId: menuItems.pageId,
        target: menuItems.target,
        parentId: menuItems.parentId,
        depth: menuItems.depth,
        sortOrder: menuItems.sortOrder,
      })
      .from(menuItems)
      .where(and(eq(menuItems.menuId, menu.id), isNull(menuItems.deletedAt)))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));

    const pageIds = rows.map((r) => r.pageId).filter((id): id is string => !!id);
    const slugByPageId = await this.pagesPublic.getSlugsForIds(pageIds);

    return {
      ...menu,
      items: buildMenuTree(rows, (id) => slugByPageId.get(id) ?? null),
    };
  }
}

type RawRow = {
  id: string;
  label: string;
  linkType: string;
  url: string | null;
  pageId: string | null;
  target: string;
  parentId: string | null;
  depth: number;
  sortOrder: number;
};

/**
 * Build a 2-level tree from a flat list of menu_item rows. Exported for unit
 * testing. Rows are assumed to be pre-sorted by (sortOrder ASC, id ASC) so the
 * output children arrays inherit that order without re-sorting. The
 * `resolvePageSlug` callback is used to derive `href` for `linkType: 'page'`
 * rows — defaults to returning null so pure unit tests don't need to wire
 * page lookups.
 */
export function buildMenuTree(
  rows: RawRow[],
  resolvePageSlug: (pageId: string) => string | null = () => null,
): PublicMenuItemDto[] {
  const byId = new Map<string, PublicMenuItemDto>();
  for (const row of rows) {
    const linkType = row.linkType as 'url' | 'page';
    const href =
      linkType === 'url'
        ? row.url
        : row.pageId
          ? (() => {
              const slug = resolvePageSlug(row.pageId);
              return slug ? `/${slug}` : null;
            })()
          : null;
    byId.set(row.id, {
      id: row.id,
      label: row.label,
      linkType,
      url: row.url,
      pageId: row.pageId,
      href,
      target: row.target as '_self' | '_blank',
      depth: row.depth,
      sortOrder: row.sortOrder,
      children: [],
    });
  }

  const roots: PublicMenuItemDto[] = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    if (row.parentId) {
      const parent = byId.get(row.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node); // orphaned child — surface at root so nothing is silently dropped
    } else {
      roots.push(node);
    }
  }
  return roots;
}
