import type { INestApplicationContext } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService, users } from '@packages/database';
import { menus } from '../menus/schema/menus';
import { menuItems } from '../menus/schema/menu-items';
import { pages } from '../pages/schema';

/**
 * Demo seed for the `primary` site menu — the one rendered by the customer
 * SiteHeader. Two-level structure:
 *
 *   Services           ← parent (no link of its own)
 *     Implementation    → /services/implementation
 *     Managed Operations → /services/managed-operations
 *     Advisory          → /services/advisory
 *   Work               → /work
 *   About              → /about
 *   Contact            → /contact
 *
 * Idempotent: short-circuits if a menu with slug 'primary' already exists.
 * Anything below depth 1 is rejected by the menu-items config; this seed
 * stays at depth 0 + 1.
 */
export const seedDemoMenus = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  const [existing] = await database.db
    .select({ id: menus.id })
    .from(menus)
    .where(eq(menus.slug, 'primary'))
    .limit(1);
  if (existing) return;

  const [menu] = await database.db
    .insert(menus)
    .values({
      name: 'Primary',
      slug: 'primary',
      description: 'Primary site navigation rendered in the customer header.',
      createdBy: admin.id,
    })
    .returning({ id: menus.id });

  // Top-level "Services" — no link of its own; just the parent of three
  // detail pages. The header dropdown still picks it up because the
  // public menu API includes parents with children regardless of href.
  const [servicesNode] = await database.db
    .insert(menuItems)
    .values({
      menuId: menu.id,
      label: 'Services',
      linkType: 'page',
      pageId: await pageIdBySlug(database, 'services'),
      sortOrder: 10,
      depth: 0,
      path: '/',
      createdBy: admin.id,
    })
    .returning({ id: menuItems.id });

  // Service detail children. Path/depth follow the materialised-path
  // convention: depth 1, path = `/${parentId}/`.
  const childPath = `/${servicesNode.id}/`;
  const childRows = [
    { label: 'Implementation', slug: 'services/implementation', sortOrder: 10 },
    { label: 'Managed Operations', slug: 'services/managed-operations', sortOrder: 20 },
    { label: 'Advisory', slug: 'services/advisory', sortOrder: 30 },
  ];
  for (const c of childRows) {
    await database.db.insert(menuItems).values({
      menuId: menu.id,
      label: c.label,
      linkType: 'page',
      pageId: await pageIdBySlug(database, c.slug),
      sortOrder: c.sortOrder,
      depth: 1,
      path: childPath,
      parentId: servicesNode.id,
      createdBy: admin.id,
    });
  }

  // Other top-level items.
  const topLevel = [
    { label: 'Work', slug: 'work', sortOrder: 20 },
    { label: 'About', slug: 'about', sortOrder: 30 },
    { label: 'Contact', slug: 'contact', sortOrder: 40 },
  ];
  for (const t of topLevel) {
    await database.db.insert(menuItems).values({
      menuId: menu.id,
      label: t.label,
      linkType: 'page',
      pageId: await pageIdBySlug(database, t.slug),
      sortOrder: t.sortOrder,
      depth: 0,
      path: '/',
      createdBy: admin.id,
    });
  }
};

async function pageIdBySlug(db: DatabaseService, slug: string): Promise<string | null> {
  const [row] = await db.db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1);
  return row?.id ?? null;
}
