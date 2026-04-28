import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, users } from '@packages/database';
import { pages, sections } from '../pages/schema';
import type { DataSource } from '@domains/agency-contract';
import { eq } from 'drizzle-orm';

/**
 * Full-site demo seed for a web development agency (web / mobile / AI / Shopify
 * / digital marketing). Each page is composed from the starter block set
 * (hero, text, image, feature-list, cta, process-timeline, case-study-grid,
 * pricing, contact-form-placeholder) so every piece of copy lives in the
 * section's `customFields` JSONB and is editable section-by-section in the
 * admin.
 *
 * Images are direct Unsplash URLs — the starter blocks accept URL strings, no
 * media-asset UUID resolution happens in the public pages response. Admins can
 * swap any URL through the section editor.
 *
 * Idempotent per slug: a page is inserted only if its slug is free. Safe to
 * run alongside `seedDemoPage` (which owns `home-content`). Order is published
 * immediately so `GET /public/pages/{slug}` returns them from the moment the
 * seed completes.
 */

interface SectionSeed {
  order: number;
  blockKind: string;
  variant?: string;
  title?: string | null;
  customFields: Record<string, unknown>;
  /** Optional server-resolved data source. When present, the public pages
   * service runs the query and a registered mapper turns the result rows
   * into block-shaped fields before render. */
  dataSource?: DataSource;
}

interface PageSeed {
  slug: string;
  title: string;
  metaDescription: string;
  sections: SectionSeed[];
}

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=2000&auto=format&fit=crop&q=80';
const AI_IMAGE =
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&auto=format&fit=crop&q=80';

const CASE_ECOM =
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&auto=format&fit=crop&q=80';
const CASE_MOBILE =
  'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=900&auto=format&fit=crop&q=80';
const CASE_AI_DASH =
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80';
const CASE_CORPORATE =
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80';
const CASE_MARKETING =
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=900&auto=format&fit=crop&q=80';
const CASE_MOBILE_UI =
  'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=900&auto=format&fit=crop&q=80';

const HOME: PageSeed = {
  slug: 'home',
  title: 'Home',
  metaDescription:
    'A compact team of senior engineers and designers shipping web, mobile, and AI products end-to-end.',
  sections: [
    {
      order: 0,
      blockKind: 'hero',
      variant: 'editorial',
      title: 'Hero',
      customFields: {
        number: '01',
        eyebrow: 'Studio',
        meta: 'Brooklyn · Est. 2019',
        headline: 'Ambitious products for what comes next.',
        subheadline:
          'A compact team of senior engineers and designers, shipping web, mobile, and AI products end-to-end — from first sketch to production at scale.',
        ctaText: 'Start a project',
        ctaHref: '/contact',
        ctaSecondaryText: 'See our work',
        ctaSecondaryHref: '/work',
      },
    },
    {
      order: 1,
      blockKind: 'awards-strip',
      variant: 'inverse',
      title: 'Recognitions',
      customFields: {
        items: [
          'Awwwards · Site of the Day',
          'FWA · Mobile of the Day',
          'CSS Design Awards · Special Kudos',
          'Communication Arts · Webpick',
          'Webby Awards · Honoree',
          'TYPE01 · Featured',
        ].join('\n'),
      },
    },
    {
      order: 2,
      blockKind: 'feature-list',
      variant: 'editorial',
      title: 'What we build',
      customFields: {
        number: '02',
        eyebrow: 'Practices',
        heading: 'Six practices, one team.',
        items: [
          'Web platforms :: Marketing sites, dashboards, and internal tools built on modern TypeScript stacks.',
          'Mobile apps :: Native iOS and Android apps and cross-platform React Native builds.',
          'AI products :: LLM-native workflows, RAG pipelines, and agent systems in production.',
          'Shopify :: Headless storefronts on Hydrogen, custom themes, and app integrations.',
          'Digital marketing :: Technical SEO, paid acquisition, and analytics instrumentation.',
          'Strategy & design :: Product discovery, UX, and brand systems that ship with the code.',
        ].join('\n'),
      },
    },
    {
      order: 3,
      blockKind: 'case-study-grid',
      title: 'Recent work',
      // Live data source — the home page's case-study tiles render from the
      // case_studies entity. Author can pin overrides via customFields,
      // but the entries themselves come from the seeded case studies.
      dataSource: {
        kind: 'entity-query',
        entity: 'case-studies',
        sort: 'displayOrder',
        limit: 4,
      },
      customFields: {
        number: '03',
        eyebrow: 'Selected work',
        heading: 'Recent projects, shipped.',
        subheading:
          'A small sample of work from the last twelve months — every one of these started with a 30-minute call.',
      },
    },
    {
      order: 4,
      blockKind: 'stats-row',
      variant: 'inverse',
      title: 'Studio stats',
      // Live numbers come from the stats entity. Layout owner is the seed —
      // the section header below is what the visitor reads.
      dataSource: {
        kind: 'entity-query',
        entity: 'stats',
        sort: 'displayOrder',
        limit: 4,
      },
      customFields: {
        number: '04',
        eyebrow: 'By the numbers',
        heading: 'Five years, kept small on purpose.',
        subheading:
          'No juniors to supervise, no hand-offs, no account managers in the middle. The person who writes the code is the person you talk to.',
      },
    },
    {
      order: 5,
      blockKind: 'cta',
      variant: 'sign-off',
      title: 'Sign-off',
      customFields: {
        heading: "Let's build something that matters.",
        body: 'We take on a handful of new engagements each quarter. The good ones start with a 30-minute call — no slides, no salespeople, just a conversation about what you need.',
        primaryText: 'Schedule a call',
        primaryHref: '/contact',
        secondaryText: 'See all services',
        secondaryHref: '/services',
      },
    },
  ],
};

const ABOUT: PageSeed = {
  slug: 'about',
  title: 'About',
  metaDescription:
    'A small team of senior engineers and designers. Founded 2019. No hand-offs, no juniors to supervise.',
  sections: [
    {
      order: 0,
      blockKind: 'hero',
      variant: 'centered',
      title: 'Hero',
      customFields: {
        eyebrow: 'About',
        headline: 'A small team, shipping work that matters.',
        subheadline:
          'Founded in 2019 by engineers tired of oversold, under-delivered agency work. We stayed small on purpose.',
      },
    },
    {
      order: 1,
      blockKind: 'text',
      title: 'Story',
      customFields: {
        heading: 'How we got here',
        body: `We spent a decade inside fast-growing product companies before starting the studio. The agency work we saw from the outside was often bloated, over-documented, and under-shipped. We wanted something different — a studio run by senior engineers, paid for outcomes, not hours.

Five years later, we're eleven people across four cities. We keep the team small because senior engineers do the work end-to-end, from architecture through deploy. No hand-offs. No juniors to supervise. Just the person who writes the code talking directly to you.`,
      },
    },
    {
      order: 2,
      blockKind: 'feature-list',
      title: 'Values',
      customFields: {
        heading: 'What we believe',
        items: [
          'Work ships :: Code in production beats perfect code in a branch. Always.',
          'Small teams win :: Two senior engineers outperform a team of ten. It compounds over quarters.',
          'No hand-offs :: The person you talk to is the person writing the code.',
          'Outcomes over hours :: Fixed bids for scoped work. Hourly only when the work is genuinely discovery.',
          'Own the whole stack :: Frontend, backend, infra, analytics. No "that\'s another team".',
          'Leave things better :: Clean repos, written docs, handover playbooks. No vendor lock-in.',
        ].join('\n'),
      },
    },
    {
      order: 3,
      blockKind: 'cta',
      variant: 'banner',
      title: 'Closing CTA',
      customFields: {
        heading: 'Want to work together?',
        body: 'We take on a handful of new engagements each quarter.',
        primaryText: 'Get in touch',
        primaryHref: '/contact',
      },
    },
  ],
};

const SERVICES: PageSeed = {
  slug: 'services',
  title: 'Services',
  metaDescription:
    'Web development, mobile apps, AI engineering, Shopify, and digital marketing — scoped to outcomes.',
  sections: [
    {
      order: 0,
      blockKind: 'hero',
      variant: 'centered',
      title: 'Hero',
      customFields: {
        eyebrow: 'Services',
        headline: 'Work we take on.',
        subheadline:
          'Five practices, one team. Most engagements span more than one — we scope to the outcome, not the title.',
      },
    },
    {
      order: 1,
      blockKind: 'feature-list',
      title: 'Practices',
      customFields: {
        heading: 'Practices',
        items: [
          'Web development :: Marketing sites, SaaS dashboards, and internal tools on Next.js, Remix, and the wider TypeScript ecosystem.',
          'Mobile apps :: iOS, Android, and React Native apps — from first build through App Store submission and ongoing release cadence.',
          'AI engineering :: LLM apps, RAG pipelines, agent systems, and fine-tuning. Production-grade, not demos.',
          'Shopify :: Headless storefronts on Hydrogen, Liquid theme builds, Shopify apps, and migration from legacy ecom stacks.',
          'Digital marketing :: Technical SEO, paid acquisition (Meta, Google, LinkedIn), analytics instrumentation, and conversion optimization.',
        ].join('\n'),
      },
    },
    {
      order: 2,
      blockKind: 'process-timeline',
      title: 'How we work',
      customFields: {
        heading: 'How we work',
        subheading:
          'A repeatable shape for most engagements. We adjust the edges; the spine stays the same.',
        steps: [
          'Discovery :: Two weeks of interviews, audits, and scoping. You get a written plan and a fixed bid.',
          'Design :: Figma, fast iteration, design reviews every three days. Approved screens feed build.',
          'Build :: Weekly demo every Friday. Staging environment from week one. PRs open the whole way.',
          'Launch :: Zero-downtime cutover, analytics live, monitoring in place. A playbook you can act on.',
          'Ongoing :: Monthly or quarterly retainers for continued improvement. Or hand off clean and walk away.',
        ].join('\n'),
      },
    },
    {
      order: 3,
      blockKind: 'pricing',
      title: 'Pricing',
      customFields: {
        heading: 'How engagements are priced',
        subheading:
          'Fixed bids for scoped work, retainers for ongoing capacity, hourly only for genuine discovery.',
        tiers: `Discovery
From $6k
Two-week paid discovery
Interviews, audit, and architecture plan
Written recommendations + fixed bid
Credited toward build if we ship together
Start discovery :: /contact

Build (recommended)
From $45k
Fixed-bid scoped project
Design + engineering end-to-end
Weekly demos, staging from day one
Launch support + 30-day warranty
Start a build :: /contact

Retainer
From $12k/mo
Ongoing engineering capacity
Senior engineer + PM on your cadence
Quarterly roadmap, monthly retro
Cancel any month after month three
Start a retainer :: /contact`,
      },
    },
    {
      order: 4,
      blockKind: 'feature-list',
      title: 'Always included',
      customFields: {
        heading: "What's always included",
        items: [
          'Fixed bid :: No scope-creep surprises. If the spec changes, we re-bid transparently.',
          'Weekly demo :: Every Friday, live. You see the work as it is built, not at the end.',
          'Code you own :: Everything in your GitHub from day one. No vendor lock. No hidden repos.',
          'Production-grade :: Infra as code, CI/CD, monitoring. Not just a repo.',
          'Written handover :: Runbook, architecture doc, one-pager for the next team.',
          'Direct access :: Slack with the people writing the code. No account managers in between.',
        ].join('\n'),
      },
    },
    {
      order: 5,
      blockKind: 'cta',
      variant: 'centered',
      title: 'Closing CTA',
      customFields: {
        heading: 'Ready to start?',
        body: "Book a 30-minute intro call. We'll walk through what you need and what a good engagement looks like.",
        primaryText: 'Book a call',
        primaryHref: '/contact',
      },
    },
  ],
};

const WORK: PageSeed = {
  slug: 'work',
  title: 'Selected work',
  metaDescription:
    'A curated sample of recent client work across web, mobile, AI, Shopify, and growth engagements.',
  sections: [
    {
      order: 0,
      blockKind: 'hero',
      variant: 'centered',
      title: 'Hero',
      customFields: {
        eyebrow: 'Selected work',
        headline: 'Recent projects, shipped.',
        subheadline:
          "A curated sample. We ship under NDA as often as not — ask us about the work you can't see here.",
      },
    },
    {
      order: 1,
      blockKind: 'case-study-grid',
      title: 'Cases',
      customFields: {
        heading: null,
        subheading: null,
        entries: [
          `Halston Financial :: Compliance dashboard that replaced six spreadsheets :: /work :: ${CASE_CORPORATE}`,
          `Northshore Logistics :: Driver app for a 2,000-strong last-mile fleet :: /work :: ${CASE_MOBILE_UI}`,
          `Brightline Health :: RAG system for clinical policy lookup :: /work :: ${CASE_AI_DASH}`,
          `Maven Atelier :: Headless Shopify storefront + fulfilment integration :: /work :: ${CASE_ECOM}`,
          `Kestrel Robotics :: Internal tools and analytics for a hardware team :: /work :: ${CASE_MOBILE}`,
          `Halston Growth :: Paid acquisition + landing-page engine :: /work :: ${CASE_MARKETING}`,
        ].join('\n'),
      },
    },
    {
      order: 2,
      blockKind: 'cta',
      variant: 'split',
      title: 'Closing CTA',
      customFields: {
        heading: 'Your next project?',
        body: 'We take a handful of new engagements each quarter. The good ones start with a call.',
        primaryText: 'Start a project',
        primaryHref: '/contact',
      },
    },
  ],
};

const CONTACT: PageSeed = {
  slug: 'contact',
  title: 'Contact',
  metaDescription: "Tell us what you're building. We reply within one business day.",
  sections: [
    {
      order: 0,
      blockKind: 'hero',
      variant: 'centered',
      title: 'Hero',
      customFields: {
        eyebrow: 'Contact',
        headline: "Let's build something.",
        subheadline:
          "Tell us what you're thinking. We read every message and reply within one business day.",
      },
    },
    {
      order: 1,
      blockKind: 'contact-form-placeholder',
      title: 'Form',
      customFields: {
        heading: 'Start a conversation',
        subheading: "Share what you're working on. We'll reply with a plan for the first call.",
        submitLabel: 'Send message',
        helperText:
          'Prefer email? hello@example.com. We have teams in San Francisco, London, and Dubai.',
      },
    },
    {
      order: 2,
      blockKind: 'feature-list',
      title: 'Other ways to reach us',
      customFields: {
        heading: 'Other ways to reach us',
        items: [
          'Email :: hello@example.com — we check it every morning.',
          'Schedule :: calendly.com/example — pick a time that works for you.',
          'Careers :: careers@example.com — always looking for senior engineers.',
          'Press :: press@example.com — for interviews and speaking.',
        ].join('\n'),
      },
    },
  ],
};

const SERVICES_AI: PageSeed = {
  slug: 'services-ai',
  title: 'AI Engineering',
  metaDescription:
    'LLM apps, RAG pipelines, agent systems, and fine-tuning. Production-grade AI engineering.',
  sections: [
    {
      order: 0,
      blockKind: 'hero',
      variant: 'split',
      title: 'Hero',
      customFields: {
        eyebrow: 'Services / AI',
        headline: 'AI products, built for production.',
        subheadline:
          'We ship AI-native applications — LLM workflows, RAG pipelines, agent systems — with the rigor of any other production software. Latency budgets, eval suites, cost controls, all in place.',
        ctaText: 'Start an AI project',
        ctaHref: '/contact',
        ctaSecondaryText: 'See all services',
        ctaSecondaryHref: '/services',
        imageUrl: AI_IMAGE,
      },
    },
    {
      order: 1,
      blockKind: 'feature-list',
      title: 'What we build',
      customFields: {
        heading: 'What we build',
        items: [
          'RAG pipelines :: Retrieval-augmented generation on your docs, with grounded citations and recall metrics.',
          'Agent systems :: Multi-step workflows with tool use, memory, and human-in-the-loop escape hatches.',
          'LLM apps :: Chat interfaces, Copilot-style assistants, and structured-output endpoints on OpenAI, Anthropic, and Google.',
          'Evals :: Offline eval suites plus production monitoring. Catch regressions before users do.',
          'Cost controls :: Caching, routing, and model selection that keep unit economics in the green.',
          'Fine-tuning :: When base models fall short. Data prep, training, eval, deploy.',
        ].join('\n'),
      },
    },
    {
      order: 2,
      blockKind: 'process-timeline',
      title: 'AI process',
      customFields: {
        heading: 'How AI engagements run',
        subheading:
          'Faster iteration cycles than traditional software. Same disciplines on the build side.',
        steps: [
          'Framing :: One week. Jobs-to-be-done, eval criteria, baseline metrics. We exit with go/no-go.',
          'Prototype :: Two weeks. Thin slice, real data, initial evals. You see it work before we scale.',
          'Harden :: Four to eight weeks. Latency budget, cost model, monitoring, production deploy.',
          'Iterate :: Ongoing. Weekly evals, prompt versioning, model upgrades as they land.',
        ].join('\n'),
      },
    },
    {
      order: 3,
      blockKind: 'case-study-grid',
      title: 'AI work',
      customFields: {
        heading: 'AI work',
        subheading: "A small sample of AI systems we've shipped.",
        entries: [
          `Brightline Health :: RAG system for clinical policy lookup :: /work :: ${CASE_AI_DASH}`,
          `Halston Financial :: Agent that reconciles trade breaks :: /work :: ${CASE_CORPORATE}`,
          `Maven Atelier :: AI-assisted product content generation :: /work :: ${CASE_ECOM}`,
        ].join('\n'),
      },
    },
    {
      order: 4,
      blockKind: 'cta',
      variant: 'centered',
      title: 'Closing CTA',
      customFields: {
        heading: 'AI project in the plan?',
        body: "Happy to talk through what you're building. We can usually tell in one call whether we're a fit.",
        primaryText: 'Book an AI call',
        primaryHref: '/contact',
        secondaryText: 'See all services',
        secondaryHref: '/services',
      },
    },
  ],
};

const SERVICE_IMPLEMENTATION: PageSeed = {
  slug: 'services/implementation',
  title: 'Implementation',
  metaDescription:
    'White-glove implementation: dedicated migration specialist, weekly demos, fixed bid, code you own.',
  sections: [
    {
      order: 0,
      blockKind: 'hero',
      variant: 'centered',
      title: 'Hero',
      customFields: {
        eyebrow: 'Services / Implementation',
        headline: 'Implementation that ends with a working product, not a deck.',
        subheadline:
          'A dedicated specialist owns your migration end-to-end — discovery, data mapping, configuration workshops, cutover, and handover. You see staging from week one and production at the end.',
        ctaText: 'Book a kickoff',
        ctaHref: '/contact',
        ctaSecondaryText: 'See all services',
        ctaSecondaryHref: '/services',
      },
    },
    {
      order: 1,
      blockKind: 'feature-list',
      title: 'What we do',
      customFields: {
        heading: "What's in an implementation engagement",
        items: [
          'Discovery :: One to two weeks of interviews, audits, and architecture. You leave with a written plan and a fixed bid.',
          'Data migration :: Field mapping, validation, dry runs, and a documented cutover. Reversible until go-live.',
          'Configuration :: Workflows, permissions, integrations — set up live with your team in working sessions, not handed over in a doc.',
          'Build & customize :: Anything the platform doesn\'t do out of the box. Built into your repo, owned by you.',
          'Cutover & training :: Zero-downtime cutover, hands-on training, and a runbook for the first 90 days.',
          'Handover :: Architecture doc, runbook, written recommendations. Either keep us on retainer or take it home.',
        ].join('\n'),
      },
    },
    {
      order: 2,
      blockKind: 'process-timeline',
      title: 'Implementation timeline',
      customFields: {
        heading: 'How an implementation runs',
        subheading: 'Eight to twelve weeks for most teams. Compressed if you have urgency, extended only when scope warrants it.',
        steps: [
          'Week 1–2 :: Discovery, scoping, written plan, fixed bid.',
          'Week 3–5 :: Data mapping + first migration dry run on staging.',
          'Week 6–8 :: Configuration workshops, integrations, custom build.',
          'Week 9–10 :: Cutover dress rehearsal, then production cutover.',
          'Week 11–12 :: Training, hand-holding, runbook handover.',
        ].join('\n'),
      },
    },
    {
      order: 3,
      blockKind: 'cta',
      variant: 'banner',
      title: 'CTA',
      customFields: {
        heading: 'Ready to plan your implementation?',
        body: 'A 30-minute call is enough for us to scope the engagement and tell you what a good outcome looks like.',
        primaryText: 'Book a kickoff',
        primaryHref: '/contact',
        secondaryText: 'See all services',
        secondaryHref: '/services',
      },
    },
  ],
};

const SERVICE_MANAGED_OPS: PageSeed = {
  slug: 'services/managed-operations',
  title: 'Managed Operations',
  metaDescription:
    'Ongoing operations support — monitoring, incident response, and continuous optimization on a fixed-fee retainer.',
  sections: [
    {
      order: 0,
      blockKind: 'hero',
      variant: 'centered',
      title: 'Hero',
      customFields: {
        eyebrow: 'Services / Managed Operations',
        headline: 'Operations on autopilot. Without losing the steering wheel.',
        subheadline:
          'A senior operator embedded with your team — running the platform day-to-day, owning the on-call rotation, and shipping continuous improvements every month.',
        ctaText: 'Talk to operations',
        ctaHref: '/contact',
        ctaSecondaryText: 'See all services',
        ctaSecondaryHref: '/services',
      },
    },
    {
      order: 1,
      blockKind: 'feature-list',
      title: 'What\'s included',
      customFields: {
        heading: "What's in the retainer",
        items: [
          '24/7 monitoring :: Alerting, dashboards, and a documented incident response playbook tuned to your business.',
          'On-call rotation :: A senior operator on call. SLO-backed response times. We carry the pager.',
          'Continuous improvement :: A monthly improvement budget. We close one class of toil per cycle and report on it.',
          'Quarterly review :: A written health report — uptime, MTTR, cost, what changed, what we recommend next.',
          'Slack-first communication :: Same-day responses for non-urgent items. No tickets. No portals.',
          'Code you own :: Everything we ship lives in your repo. Cancel any month and it stays yours.',
        ].join('\n'),
      },
    },
    {
      order: 2,
      blockKind: 'pricing',
      title: 'Pricing',
      customFields: {
        heading: 'Retainer tiers',
        subheading: 'Sized to the surface area of your platform, not the calendar.',
        tiers: `Standby
From $4.5k/mo
Monitoring + on-call
Same-day non-urgent response
Monthly health report
Cancel monthly :: /contact

Operate
From $12k/mo
Everything in Standby
Continuous improvement budget
Quarterly review + roadmap
Recommended for production teams :: /contact

Embed
From $24k/mo
Everything in Operate
Senior operator embedded 50%
Architecture + capacity planning
For teams running mission-critical platforms :: /contact`,
      },
    },
    {
      order: 3,
      blockKind: 'cta',
      variant: 'banner',
      title: 'CTA',
      customFields: {
        heading: 'Stop carrying the pager.',
        body: "We pick it up. You ship the next thing. Let's talk about what your stack actually needs.",
        primaryText: 'Talk to operations',
        primaryHref: '/contact',
        secondaryText: 'See all services',
        secondaryHref: '/services',
      },
    },
  ],
};

const SERVICE_ADVISORY: PageSeed = {
  slug: 'services/advisory',
  title: 'Advisory',
  metaDescription:
    'Strategic guidance from senior practitioners — quarterly reviews, embedded support, or anything in between.',
  sections: [
    {
      order: 0,
      blockKind: 'hero',
      variant: 'centered',
      title: 'Hero',
      customFields: {
        eyebrow: 'Services / Advisory',
        headline: 'Senior brain on tap, without the senior hire.',
        subheadline:
          'For founders and operators wrestling with architecture, hiring, vendor selection, or the next-12-months roadmap. Light touch when that\'s right; embedded when the stakes warrant it.',
        ctaText: 'Explore advisory',
        ctaHref: '/contact',
        ctaSecondaryText: 'See all services',
        ctaSecondaryHref: '/services',
      },
    },
    {
      order: 1,
      blockKind: 'feature-list',
      title: 'Engagements',
      customFields: {
        heading: 'What we advise on',
        items: [
          'Architecture review :: An outside set of eyes on your stack. We exit with written recommendations, prioritized.',
          'Hiring :: Job ladders, interview loops, scorecards. We sit on a few panels until your bar is set.',
          'Vendor selection :: We\'ve evaluated more tools than you have. RFP shape, demo questions, total-cost math.',
          'Roadmap planning :: Quarterly off-sites, written plans, executive presentations. We help you say no.',
          'Founder coaching :: 1:1 monthly with a senior practitioner. Bring the hard problem; leave with a path.',
          'Board prep :: We\'ve walked many boards through tech updates. We can help you prepare and rehearse.',
        ].join('\n'),
      },
    },
    {
      order: 2,
      blockKind: 'feature-list',
      title: 'Shape',
      customFields: {
        heading: 'Engagement shape',
        items: [
          'Sprint :: One to four weeks, fixed-bid, scoped to a specific question.',
          'Quarterly :: A standing relationship — monthly 1:1, written quarterly review, ad hoc Slack access.',
          'Embedded :: Two to three days a week, embedded with the team. For founders without a senior tech leader yet.',
        ].join('\n'),
      },
    },
    {
      order: 3,
      blockKind: 'cta',
      variant: 'banner',
      title: 'CTA',
      customFields: {
        heading: 'Got a hard call ahead?',
        body: 'Book a free 30-minute call. We\'ll tell you whether you need an advisor or just a fresh coffee.',
        primaryText: 'Explore advisory',
        primaryHref: '/contact',
        secondaryText: 'See all services',
        secondaryHref: '/services',
      },
    },
  ],
};

const AGENCY_PAGES: PageSeed[] = [
  HOME,
  ABOUT,
  SERVICES,
  WORK,
  CONTACT,
  SERVICES_AI,
  SERVICE_IMPLEMENTATION,
  SERVICE_MANAGED_OPS,
  SERVICE_ADVISORY,
];

export const seedDemoPages = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  for (const seed of AGENCY_PAGES) {
    const [existing] = await database.db
      .select({ id: pages.id })
      .from(pages)
      .where(eq(pages.slug, seed.slug))
      .limit(1);
    if (existing) continue;

    const publishedAt = new Date();
    const [page] = await database.db
      .insert(pages)
      .values({
        slug: seed.slug,
        title: seed.title,
        metaDescription: seed.metaDescription,
        status: 'published',
        publishedAt,
        createdBy: admin.id,
      })
      .returning({ id: pages.id });

    for (const s of seed.sections) {
      await database.db.insert(sections).values({
        pageId: page.id,
        order: s.order,
        blockKind: s.blockKind,
        variant: s.variant ?? null,
        title: s.title ?? null,
        customFields: s.customFields,
        dataSource: s.dataSource ?? null,
      });
    }
  }
};
