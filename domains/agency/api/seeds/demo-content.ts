import type { INestApplicationContext } from '@nestjs/common';
import type { PgTable } from 'drizzle-orm/pg-core';
import { DatabaseService, users } from '@packages/database';
import {
  testimonials,
  faqItems,
  teamMembers,
  services,
  clientLogos,
  valueProps,
  stats,
  caseStudies,
} from '@packages/content-api';
import type { EntityService } from '@packages/entity-engine';

/**
 * Placeholder MediaFile shape for seeded file fields. The file field save
 * hook only reacts to `tmp/` keys, so non-tmp keys pass straight through to
 * the DB. The UI will render broken thumbnails until users upload real assets
 * through the admin — this is expected for demo data.
 */
function placeholderMedia(slug: string, mime = 'image/png'): string {
  return JSON.stringify({
    key: `placeholder/${slug}.png`,
    originalName: `${slug}.png`,
    mimeType: mime,
    size: 0,
    uploadedAt: new Date().toISOString(),
  });
}

const TESTIMONIALS = [
  {
    authorName: 'Sarah Chen',
    authorRole: 'Head of People Ops',
    companyName: 'Brightline Health',
    quote:
      'The transition was frictionless. Our team was set up on day one and the reporting surfaced blind spots we had carried for years.',
    avatarUrl: placeholderMedia('sarah-chen'),
    companyLogoUrl: placeholderMedia('brightline'),
    displayOrder: 10,
    isActive: true,
  },
  {
    authorName: 'Marcus Patel',
    authorRole: 'COO',
    companyName: 'Northshore Logistics',
    quote:
      'We replaced three separate tools with one and our weekly ops review is finally a conversation, not a data pull.',
    avatarUrl: placeholderMedia('marcus-patel'),
    companyLogoUrl: placeholderMedia('northshore'),
    displayOrder: 20,
    isActive: true,
  },
  {
    authorName: 'Imani Okafor',
    authorRole: 'Compliance Director',
    companyName: 'Halston Financial Group',
    quote:
      'Audit prep went from a month-long scramble to a morning. The trail is there, the attestations are there, and nothing lives in a spreadsheet.',
    companyLogoUrl: placeholderMedia('halston'),
    displayOrder: 30,
    isActive: true,
  },
];

const FAQ_ITEMS = [
  {
    question: 'How long does onboarding take?',
    answer:
      'Most teams are live inside two weeks. Your migration specialist handles the data import, we handle the integrations, and you spend about four hours across configuration workshops.',
    category: 'Getting started',
    displayOrder: 10,
    isActive: true,
  },
  {
    question: 'Can we import our existing data?',
    answer:
      'Yes — we support CSV, JSON, and direct imports from the most common tools in our category. The migration specialist will map your fields and validate the import with you before cutover.',
    category: 'Getting started',
    displayOrder: 20,
    isActive: true,
  },
  {
    question: 'What happens if we need to cancel?',
    answer:
      'You can export your data at any time in open formats (CSV + JSON). We do not hold data hostage and there are no cancellation fees on any plan.',
    category: 'Billing',
    displayOrder: 30,
    isActive: true,
  },
  {
    question: 'Do you offer custom integrations?',
    answer:
      'Enterprise plans include up to three custom integrations built by our team. We also publish a webhook API and a REST API that your team can use to build any integration you like.',
    category: 'Integrations',
    displayOrder: 40,
    isActive: true,
  },
];

const TEAM_MEMBERS = [
  {
    fullName: 'Alex Rivera',
    role: 'Founder & CEO',
    bio: 'Alex spent a decade building ops software at fast-growing startups before starting the company in 2019.',
    photoUrl: placeholderMedia('alex-rivera'),
    linkedinUrl: 'https://linkedin.com/in/alex-rivera-demo',
    email: 'alex@example.com',
    displayOrder: 10,
    isActive: true,
  },
  {
    fullName: 'Priya Desai',
    role: 'Head of Engineering',
    bio: 'Priya leads the engineering organization. Prior to joining she was a staff engineer at two unicorns.',
    photoUrl: placeholderMedia('priya-desai'),
    linkedinUrl: 'https://linkedin.com/in/priya-desai-demo',
    email: 'priya@example.com',
    displayOrder: 20,
    isActive: true,
  },
  {
    fullName: 'Daniel Kim',
    role: 'VP of Customer Success',
    bio: 'Daniel makes sure every customer gets to their first win fast. His team runs onboarding, training, and account health.',
    photoUrl: placeholderMedia('daniel-kim'),
    linkedinUrl: 'https://linkedin.com/in/daniel-kim-demo',
    email: 'daniel@example.com',
    displayOrder: 30,
    isActive: true,
  },
];

const SERVICES = [
  {
    name: 'Implementation',
    description:
      'White-glove migration, data mapping, and configuration workshops led by a dedicated specialist.',
    iconName: 'Rocket',
    ctaText: 'Learn more',
    ctaHref: '/services/implementation',
    displayOrder: 10,
    isActive: true,
  },
  {
    name: 'Managed Operations',
    description:
      'Ongoing operations support — monitoring, incident response, and continuous optimization of your workflows.',
    iconName: 'ShieldCheck',
    ctaText: 'Learn more',
    ctaHref: '/services/managed-operations',
    displayOrder: 20,
    isActive: true,
  },
  {
    name: 'Advisory',
    description:
      'Strategic guidance from senior practitioners. Engagements sized from quarterly reviews to full embedded support.',
    iconName: 'Compass',
    ctaText: 'Learn more',
    ctaHref: '/services/advisory',
    displayOrder: 30,
    isActive: true,
  },
];

const CLIENT_LOGOS = [
  {
    name: 'Brightline Health',
    logoUrl: placeholderMedia('brightline', 'image/svg+xml'),
    href: 'https://example.com/brightline',
    displayOrder: 10,
    isActive: true,
  },
  {
    name: 'Northshore Logistics',
    logoUrl: placeholderMedia('northshore', 'image/svg+xml'),
    href: 'https://example.com/northshore',
    displayOrder: 20,
    isActive: true,
  },
  {
    name: 'Halston Financial Group',
    logoUrl: placeholderMedia('halston', 'image/svg+xml'),
    href: 'https://example.com/halston',
    displayOrder: 30,
    isActive: true,
  },
  {
    name: 'Kestrel Robotics',
    logoUrl: placeholderMedia('kestrel', 'image/svg+xml'),
    href: 'https://example.com/kestrel',
    displayOrder: 40,
    isActive: true,
  },
  {
    name: 'Maven Atelier',
    logoUrl: placeholderMedia('maven', 'image/svg+xml'),
    href: 'https://example.com/maven',
    displayOrder: 50,
    isActive: true,
  },
];

const VALUE_PROPS = [
  {
    title: 'Ship faster',
    description: 'Stop stitching three tools together. One platform, one source of truth, one bill.',
    iconName: 'Zap',
    displayOrder: 10,
    isActive: true,
  },
  {
    title: 'See the whole picture',
    description:
      'Dashboards that tell you what changed, why it changed, and what to do next — without a BI team in the loop.',
    iconName: 'LineChart',
    displayOrder: 20,
    isActive: true,
  },
  {
    title: 'Sleep through your next audit',
    description:
      'Permissioning, audit logs, and attestations built in. SOC 2 and ISO 27001 ready on day one.',
    iconName: 'ShieldCheck',
    displayOrder: 30,
    isActive: true,
  },
  {
    title: 'Grow without rebuilding',
    description:
      'Teams from ten to ten thousand use the same platform. No migration, no rip-and-replace.',
    iconName: 'TrendingUp',
    displayOrder: 40,
    isActive: true,
  },
];

const STATS = [
  { label: 'Customers', value: 2400, suffix: '+', displayOrder: 10, isActive: true },
  { label: 'Uptime', value: 99, suffix: '.98%', displayOrder: 20, isActive: true },
  { label: 'Countries', value: 38, suffix: '', displayOrder: 30, isActive: true },
  { label: 'Average time-to-value', value: 14, suffix: ' days', displayOrder: 40, isActive: true },
];

const CASE_STUDIES = [
  {
    title: 'A compliance dashboard that replaced six spreadsheets',
    slug: 'halston-compliance-dashboard',
    client: 'Halston Financial Group',
    industry: 'Financial Services',
    year: 2025,
    summary:
      'Audit prep went from a month-long scramble to a morning. Trail, attestations, controls — all live, all auditable, none in spreadsheets.',
    body:
      "Halston's compliance team was running annual audits out of a maze of spreadsheets, shared inboxes, and screenshots. Every quarter they lost a week reconciling versions before they could even start gathering evidence.\n\nWe rebuilt the workflow on a single platform — typed controls, attestations with timestamps, evidence attachments, and an audit trail that never sleeps. The first audit on the new platform finished four weeks ahead of schedule.\n\nThe team now closes the books on Monday morning, runs the audit pull on Tuesday, and spends the rest of the week on actual risk work.",
    results:
      '87% reduction in audit-prep time\nSingle source of truth for 240+ controls\nFour-week audit closure (was 8 weeks)',
    heroImageUrl:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&auto=format&fit=crop&q=80',
    ctaText: 'Read the full story',
    ctaHref: '/contact',
    displayOrder: 10,
    isActive: true,
    publishedAt: new Date('2025-08-15'),
  },
  {
    title: 'Driver app for a 2,000-strong last-mile fleet',
    slug: 'northshore-driver-app',
    client: 'Northshore Logistics',
    industry: 'Logistics',
    year: 2025,
    summary:
      'A native mobile app for drivers, dispatchers, and ops — replacing three legacy tools with one. Adoption hit 95% in the first month.',
    body:
      "Northshore's drivers were juggling three apps to do their job — one for routes, one for proof-of-delivery, and one for time tracking. Each one logged out daily, none of them talked to each other, and the dispatch team was the human integration layer.\n\nWe shipped a single React Native app — routes, POD with photo + signature capture, time tracking, and on-shift chat — backed by a TypeScript service that finally had one source of truth. Dispatch's role shrank from 'data router' to 'exception handler'.\n\nAdoption hit 95% in the first month. Driver satisfaction (measured by NPS) jumped 28 points by quarter's end.",
    results:
      '95% driver adoption in the first month\n+28 NPS among drivers\n3 legacy apps decommissioned',
    heroImageUrl:
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1600&auto=format&fit=crop&q=80',
    ctaText: 'Read the full story',
    ctaHref: '/contact',
    displayOrder: 20,
    isActive: true,
    publishedAt: new Date('2025-10-04'),
  },
  {
    title: 'RAG system for clinical policy lookup',
    slug: 'brightline-rag-policy-lookup',
    client: 'Brightline Health',
    industry: 'Healthcare',
    year: 2026,
    summary:
      'Care coordinators get grounded answers from 11,000 pages of policy in under two seconds — with citations they can defend in an audit.',
    body:
      "Brightline's care coordinators were spending 12 minutes per call looking up policy. A wrong answer didn't just slow the call — it created downstream payment exceptions and patient escalations.\n\nWe built a retrieval-augmented system over their full policy corpus: hybrid search, reranking, structured extraction, and a UI tuned to coordinators rather than ML researchers. Every answer cites the policy section it came from. Coverage and accuracy are tracked weekly against a held-out eval set.\n\nLookup time fell from 12 minutes to under 30 seconds. Audit-rejected guidance fell to zero in the first 90 days.",
    results:
      '12 min → 30 sec lookup time\n0 audit rejections in first 90 days\n96% coordinator satisfaction',
    heroImageUrl:
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1600&auto=format&fit=crop&q=80',
    ctaText: 'Read the full story',
    ctaHref: '/contact',
    displayOrder: 30,
    isActive: true,
    publishedAt: new Date('2026-02-12'),
  },
  {
    title: 'Headless Shopify storefront + fulfilment integration',
    slug: 'maven-headless-shopify',
    client: 'Maven Atelier',
    industry: 'Retail',
    year: 2026,
    summary:
      'A headless Hydrogen storefront on a typed schema, with real-time fulfilment from a 3PL. Page speed +40% and inventory truth across both warehouses.',
    body:
      "Maven was outgrowing their Shopify theme — checkout speed was hurting conversion, and the manual sync between their e-com platform and the 3PL was producing daily inventory drift.\n\nWe rebuilt the storefront on Hydrogen with a typed catalog schema, then wired live two-way sync between Shopify and the 3PL via a typed integration layer with retry, backpressure, and explicit reconciliation jobs. Inventory drift went to zero. Page-load time on PDPs improved 40%.\n\nNew product launches that used to take a release cycle now happen on the same day the merchandiser uploads.",
    results:
      '+40% PDP page speed\nZero daily inventory drift\nSame-day product launch (was 2 weeks)',
    heroImageUrl:
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1600&auto=format&fit=crop&q=80',
    ctaText: 'Read the full story',
    ctaHref: '/contact',
    displayOrder: 40,
    isActive: true,
    publishedAt: new Date('2026-03-20'),
  },
];

async function hasAnyRow(database: DatabaseService, table: PgTable): Promise<boolean> {
  const [existing] = await database.db.select().from(table).limit(1);
  return Boolean(existing);
}

async function seedIfEmpty(
  ctx: INestApplicationContext,
  database: DatabaseService,
  adminId: string,
  serviceToken: string,
  table: PgTable,
  records: Record<string, unknown>[],
): Promise<void> {
  if (await hasAnyRow(database, table)) return;
  const service = ctx.get<EntityService>(serviceToken, { strict: false });
  if (!service) return;
  for (const record of records) {
    await service.create(record, adminId);
  }
}

/**
 * Seed content primitives for demo. Idempotent per entity — each table is
 * skipped if it already has at least one row. File fields are populated with
 * placeholder MediaFile metadata; users are expected to replace with real
 * uploads through the admin.
 */
export const seedDemoContent = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  await seedIfEmpty(ctx, database, admin.id, 'ENTITY_SERVICE_testimonials', testimonials, TESTIMONIALS);
  await seedIfEmpty(ctx, database, admin.id, 'ENTITY_SERVICE_faq-items', faqItems, FAQ_ITEMS);
  await seedIfEmpty(ctx, database, admin.id, 'ENTITY_SERVICE_team-members', teamMembers, TEAM_MEMBERS);
  await seedIfEmpty(ctx, database, admin.id, 'ENTITY_SERVICE_services', services, SERVICES);
  await seedIfEmpty(ctx, database, admin.id, 'ENTITY_SERVICE_client-logos', clientLogos, CLIENT_LOGOS);
  await seedIfEmpty(ctx, database, admin.id, 'ENTITY_SERVICE_value-props', valueProps, VALUE_PROPS);
  await seedIfEmpty(ctx, database, admin.id, 'ENTITY_SERVICE_stats', stats, STATS);
  await seedIfEmpty(ctx, database, admin.id, 'ENTITY_SERVICE_case-studies', caseStudies, CASE_STUDIES);
};
