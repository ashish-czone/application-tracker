import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, users } from '@packages/database';
import { projects } from '../schema/projects';
import { milestones } from '../schema/milestones';
import { features } from '../schema/features';
import { tasks } from '../schema/tasks';

interface TaskSeed {
  title: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  /** YYYY-MM-DD, optional. Past + non-done becomes an overdue chip on the dashboard. */
  dueDate?: string;
  /** When true, assign to the seed's admin user so My Tasks has rows. */
  assignToAdmin?: boolean;
}

interface FeatureSeed {
  name: string;
  status: 'backlog' | 'in_progress' | 'in_review' | 'done';
  priority?: 'low' | 'medium' | 'high';
  tasks: TaskSeed[];
}

interface MilestoneSeed {
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
  features: FeatureSeed[];
}

interface ProjectSeed {
  name: string;
  slug: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  priority: 'low' | 'medium' | 'high';
  color: string;
  icon: string;
  startDate?: string;
  targetDate?: string;
  milestones: MilestoneSeed[];
}

// Fixed dates so dashboard rollups + overdue chips behave deterministically
// across reseed cycles. The "today" reference is irrelevant for non-overdue
// items but keeps seed output reviewable.
const PAST = '2025-12-15';
const FUTURE = '2026-09-30';

const PROJECT_SEEDS: ProjectSeed[] = [
  {
    name: 'Customer onboarding revamp',
    slug: 'customer-onboarding',
    description: 'Rebuild the new-customer flow end-to-end: research, redesign, ship, measure.',
    status: 'active',
    priority: 'high',
    color: '#3B82F6',
    icon: 'rocket',
    startDate: '2025-11-01',
    targetDate: '2026-06-30',
    milestones: [
      {
        name: 'Discovery & research',
        status: 'completed',
        dueDate: '2026-01-15',
        features: [
          {
            name: 'User interviews',
            status: 'done',
            priority: 'high',
            tasks: [
              { title: 'Recruit 12 customers from Q4 cohort', status: 'done' },
              { title: 'Run 30-min interviews', status: 'done' },
              { title: 'Synthesize themes into Notion doc', status: 'done' },
              { title: 'Share with leadership', status: 'done' },
            ],
          },
          {
            name: 'Process audit',
            status: 'done',
            priority: 'medium',
            tasks: [
              { title: 'Map current onboarding funnel', status: 'done' },
              { title: 'Identify drop-off points', status: 'done' },
              { title: 'Document recommended changes', status: 'done' },
            ],
          },
        ],
      },
      {
        name: 'Build new flow',
        status: 'in_progress',
        dueDate: '2026-04-30',
        features: [
          {
            name: 'Welcome screen',
            status: 'in_progress',
            priority: 'high',
            tasks: [
              { title: 'Design hero variants', status: 'done' },
              { title: 'Implement responsive layout', status: 'done' },
              { title: 'Wire up CTA tracking', status: 'in_progress', assignToAdmin: true },
              { title: 'A/B test setup', status: 'in_progress', assignToAdmin: true },
              { title: 'Copy review with marketing', status: 'todo' },
            ],
          },
          {
            name: 'Form validation',
            status: 'in_review',
            priority: 'medium',
            tasks: [
              { title: 'Inline error states', status: 'done' },
              { title: 'Server-side validation', status: 'done' },
              { title: 'QA pass on edge cases', status: 'todo', dueDate: PAST, assignToAdmin: true },
            ],
          },
          {
            name: 'Email automation',
            status: 'backlog',
            priority: 'medium',
            tasks: [
              { title: 'Welcome email template', status: 'todo' },
              { title: 'Day-3 nudge automation', status: 'todo' },
              { title: 'Day-7 check-in email', status: 'todo' },
            ],
          },
        ],
      },
      {
        name: 'Launch & monitor',
        status: 'pending',
        dueDate: '2026-06-15',
        features: [
          {
            name: 'Analytics dashboard',
            status: 'backlog',
            priority: 'low',
            tasks: [
              { title: 'Define funnel events', status: 'todo' },
              { title: 'Wire up dashboard widgets', status: 'todo' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Internal billing migration',
    slug: 'billing-migration',
    description: 'Move billing off the legacy provider onto the new self-hosted stack.',
    status: 'active',
    priority: 'medium',
    color: '#10B981',
    icon: 'credit-card',
    startDate: '2026-01-15',
    targetDate: '2026-08-31',
    milestones: [
      {
        name: 'Database schema',
        status: 'in_progress',
        dueDate: '2026-05-15',
        features: [
          {
            name: 'Drizzle migrations',
            status: 'done',
            priority: 'high',
            tasks: [
              { title: 'subscriptions table', status: 'done' },
              { title: 'invoices table', status: 'done' },
              { title: 'payment_methods table', status: 'done' },
            ],
          },
          {
            name: 'Data backfill',
            status: 'in_progress',
            priority: 'high',
            tasks: [
              { title: 'Export from legacy provider', status: 'done' },
              { title: 'Map legacy IDs to new schema', status: 'in_progress', assignToAdmin: true },
              { title: 'Dry-run import on staging', status: 'in_progress' },
              { title: 'Reconcile payment history', status: 'blocked' },
            ],
          },
        ],
      },
      {
        name: 'API rewrite',
        status: 'pending',
        dueDate: '2026-07-31',
        features: [
          {
            name: 'Subscription endpoints',
            status: 'backlog',
            priority: 'medium',
            tasks: [
              { title: 'POST /subscriptions', status: 'todo' },
              { title: 'PATCH /subscriptions/:id', status: 'todo' },
              { title: 'DELETE /subscriptions/:id', status: 'todo' },
              { title: 'Webhook signature verification', status: 'todo' },
            ],
          },
          {
            name: 'Invoice endpoints',
            status: 'backlog',
            priority: 'medium',
            tasks: [
              { title: 'List invoices for customer', status: 'todo' },
              { title: 'Generate PDF on-demand', status: 'todo' },
              { title: 'Mark paid / unpaid', status: 'todo' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Q3 marketing site refresh',
    slug: 'marketing-q3',
    description: 'Refresh copy, design, and case studies before the Q3 launch push.',
    status: 'planning',
    priority: 'high',
    color: '#F59E0B',
    icon: 'sparkles',
    startDate: '2026-05-01',
    targetDate: FUTURE,
    milestones: [
      {
        name: 'Design system',
        status: 'pending',
        features: [
          {
            name: 'Component library',
            status: 'backlog',
            tasks: [
              { title: 'Buttons + form inputs', status: 'todo' },
              { title: 'Card variants', status: 'todo' },
              { title: 'Dark mode tokens', status: 'todo' },
              { title: 'Motion guidelines', status: 'todo' },
              { title: 'Storybook entries for each', status: 'todo' },
            ],
          },
        ],
      },
      {
        name: 'Content rewrite',
        status: 'pending',
        features: [
          {
            name: 'Hero copy',
            status: 'backlog',
            tasks: [
              { title: 'Draft three hero variants', status: 'todo' },
              { title: 'Pick winner with leadership', status: 'todo' },
            ],
          },
          {
            name: 'Case studies',
            status: 'backlog',
            tasks: [
              { title: 'Interview Brightline Health', status: 'todo' },
              { title: 'Interview Northshore Logistics', status: 'todo' },
              { title: 'Interview Halston Financial', status: 'todo' },
            ],
          },
        ],
      },
    ],
  },
];

export const seedDemoProjects = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);

  // Idempotency: any row in projects short-circuits the seed. Reseeding on a
  // dirty DB would mint fresh IDs and confuse anything that captured them.
  const [existing] = await database.db.select({ id: projects.id }).from(projects).limit(1);
  if (existing) return;

  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  for (const projSeed of PROJECT_SEEDS) {
    const [project] = await database.db
      .insert(projects)
      .values({
        name: projSeed.name,
        slug: projSeed.slug,
        description: projSeed.description,
        status: projSeed.status,
        priority: projSeed.priority,
        color: projSeed.color,
        icon: projSeed.icon,
        ownerId: admin.id,
        startDate: projSeed.startDate ?? null,
        targetDate: projSeed.targetDate ?? null,
        createdBy: admin.id,
      })
      .returning({ id: projects.id });

    for (const [mIdx, mSeed] of projSeed.milestones.entries()) {
      const [milestone] = await database.db
        .insert(milestones)
        .values({
          projectId: project.id,
          name: mSeed.name,
          status: mSeed.status,
          dueDate: mSeed.dueDate ?? null,
          completedAt: mSeed.status === 'completed' ? new Date() : null,
          sortOrder: mIdx * 1000,
          createdBy: admin.id,
        })
        .returning({ id: milestones.id });

      for (const [fIdx, fSeed] of mSeed.features.entries()) {
        const [feature] = await database.db
          .insert(features)
          .values({
            milestoneId: milestone.id,
            name: fSeed.name,
            status: fSeed.status,
            priority: fSeed.priority ?? 'medium',
            assigneeId: fSeed.tasks.some((t) => t.assignToAdmin) ? admin.id : null,
            completedAt: fSeed.status === 'done' ? new Date() : null,
            sortOrder: fIdx * 1000,
            createdBy: admin.id,
          })
          .returning({ id: features.id });

        for (const [tIdx, tSeed] of fSeed.tasks.entries()) {
          await database.db.insert(tasks).values({
            featureId: feature.id,
            title: tSeed.title,
            status: tSeed.status,
            assigneeId: tSeed.assignToAdmin ? admin.id : null,
            dueDate: tSeed.dueDate ?? null,
            completedAt: tSeed.status === 'done' ? new Date() : null,
            sortOrder: tIdx * 1000,
            createdBy: admin.id,
          });
        }
      }
    }
  }
};
