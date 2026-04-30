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
 *   Services           ← parent (links to /services)
 *     Web platforms     → /services
 *     Mobile apps       → /services
 *     AI products       → /services
 *     Shopify           → /services
 *     Digital marketing → /services
 *     Product design    → /services
 *   Work               → /work
 *   About              → /about
 *   Contact            → /contact
 *
 * The dropdown mirrors the six practices listed on the home page.
 * Until per-practice deep pages exist, every child links to the
 * services page — visitors arrive at the right vocabulary.
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

  // Practice children. Mirror the six practices the home page advertises
  // so the dropdown matches the body copy. Until per-practice deep pages
  // exist, every child uses linkType='url' pointing at /services.
  // Path/depth follow the materialised-path convention: depth 1, path =
  // `/${parentId}/`.
  const childPath = `/${servicesNode.id}/`;
  const practiceChildren = [
    {
      label: 'Web platforms',
      icon: 'globe',
      description: 'CMS-backed marketing sites and content-heavy web apps.',
      sortOrder: 10,
    },
    {
      label: 'Mobile apps',
      icon: 'smartphone',
      description: 'iOS and Android products built for shipping cadence.',
      sortOrder: 20,
    },
    {
      label: 'AI products',
      icon: 'sparkles',
      description: 'LLM-powered tooling, agents, and retrieval pipelines.',
      sortOrder: 30,
    },
    {
      label: 'Shopify',
      icon: 'shopping-bag',
      description: 'Custom storefronts, headless commerce, and apps.',
      sortOrder: 40,
    },
    {
      label: 'Digital marketing',
      icon: 'megaphone',
      description: 'Paid, SEO, and lifecycle programmes that compound.',
      sortOrder: 50,
    },
    {
      label: 'Product design',
      icon: 'palette',
      description: 'Discovery, UX, and design systems for shipping teams.',
      sortOrder: 60,
    },
  ];
  for (const c of practiceChildren) {
    await database.db.insert(menuItems).values({
      menuId: menu.id,
      label: c.label,
      description: c.description,
      icon: c.icon,
      linkType: 'url',
      url: '/services',
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
