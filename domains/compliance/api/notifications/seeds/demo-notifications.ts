import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq, users } from '@packages/database';
import { notifications } from '@packages/notification-channels';

/**
 * Inserts 20 demo notifications for the admin user, spanning the time
 * buckets the NotificationPanel renders (Today / Yesterday / This week /
 * This month / Earlier). Timestamps are relative to "now" so the buckets
 * stay correct regardless of when the seed runs.
 *
 * Idempotent: returns early if the admin already has any notification.
 */
export const seedDemoNotifications = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);

  const [admin] = await database.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'admin@admin.com'))
    .limit(1);
  if (!admin) return;

  const existing = await database.db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.userId, admin.id))
    .limit(1);
  if (existing[0]) return;

  const now = Date.now();
  const minutesAgo = (n: number) => new Date(now - n * 60_000);
  const hoursAgo = (n: number) => new Date(now - n * 3_600_000);
  const daysAgo = (n: number) => new Date(now - n * 86_400_000);

  const rows = [
    // ── Today (4 unread + 2 read) ─────────────────────────────────────
    {
      userId: admin.id,
      title: 'GST-3B filing overdue',
      body: 'Filing for Reliance Industries — Q4 2025 is now past the due date. Immediate action required.',
      isRead: false,
      eventName: 'filings.overdue',
      entityType: 'filings',
      entityId: null,
      createdAt: minutesAgo(45),
    },
    {
      userId: admin.id,
      title: 'New client onboarded',
      body: 'Tata Consultancy Services has been added by Priya Sharma. 4 obligations are pending assignment.',
      isRead: false,
      eventName: 'clients.created',
      entityType: 'clients',
      entityId: null,
      createdAt: hoursAgo(2),
    },
    {
      userId: admin.id,
      title: 'Task assigned to you',
      body: 'TDS quarterly return for Infosys Ltd — Q1 2026 has been assigned to you by Deepak Iyer.',
      isRead: false,
      eventName: 'compliance-filings.assigned',
      entityType: 'compliance-filings',
      entityId: null,
      createdAt: hoursAgo(4),
    },
    {
      userId: admin.id,
      title: 'Comment on Bajaj Finance',
      body: 'Priya Sharma mentioned you in a comment on the client profile.',
      isRead: false,
      eventName: 'clients.commented',
      entityType: 'clients',
      entityId: null,
      createdAt: hoursAgo(6),
    },
    {
      userId: admin.id,
      title: 'Dashboard digest ready',
      body: '7 filings are due this week, 2 are overdue. Review the filings dashboard for details.',
      isRead: true,
      eventName: 'system.digest',
      entityType: null,
      entityId: null,
      createdAt: hoursAgo(8),
    },
    {
      userId: admin.id,
      title: 'Bulk import completed',
      body: '12 compliance rules imported successfully for Mahindra Group. 2 duplicates were skipped.',
      isRead: true,
      eventName: 'system.bulk-import',
      entityType: null,
      entityId: null,
      createdAt: hoursAgo(10),
    },

    // ── Yesterday (4) ────────────────────────────────────────────────
    {
      userId: admin.id,
      title: 'ROC annual return due in 3 days',
      body: 'Wipro Technologies — Annual return (ROC-ANN) is due on 25 Apr 2026.',
      isRead: true,
      eventName: 'filings.due-soon',
      entityType: 'filings',
      entityId: null,
      createdAt: daysAgo(1),
    },
    {
      userId: admin.id,
      title: 'Filing marked as complete',
      body: 'PF monthly return for HCL Technologies — Mar 2026 was filed by Anita Desai.',
      isRead: true,
      eventName: 'filings.completed',
      entityType: 'filings',
      entityId: null,
      createdAt: daysAgo(1.2),
    },
    {
      userId: admin.id,
      title: 'Client details updated',
      body: 'Tax identifier for Bajaj Finance Ltd was updated by Ravi Kumar.',
      isRead: true,
      eventName: 'clients.updated',
      entityType: 'clients',
      entityId: null,
      createdAt: daysAgo(1.4),
    },
    {
      userId: admin.id,
      title: 'Task reassigned to you',
      body: 'Professional Tax return for Adani Enterprises — Mar 2026 has been reassigned to you.',
      isRead: true,
      eventName: 'compliance-filings.reassigned',
      entityType: 'compliance-filings',
      entityId: null,
      createdAt: daysAgo(1.7),
    },

    // ── This week (4) ────────────────────────────────────────────────
    {
      userId: admin.id,
      title: 'GST-1 filing submitted',
      body: 'GST-1 return for Sun Pharma — Q4 2025 was filed by Anjali Iyer.',
      isRead: true,
      eventName: 'filings.submitted',
      entityType: 'filings',
      entityId: null,
      createdAt: daysAgo(2.3),
    },
    {
      userId: admin.id,
      title: 'New compliance rule added',
      body: 'TDS Section 194Q (High-Value Purchases) added to the rule library by Deepak Iyer.',
      isRead: true,
      eventName: 'compliance-rules.created',
      entityType: 'compliance_rules',
      entityId: null,
      createdAt: daysAgo(2.8),
    },
    {
      userId: admin.id,
      title: 'Weekly compliance digest',
      body: '14 filings are scheduled, 3 are overdue, 2 filings were late last week.',
      isRead: true,
      eventName: 'system.weekly-digest',
      entityType: null,
      entityId: null,
      createdAt: daysAgo(3.1),
    },
    {
      userId: admin.id,
      title: 'Task escalated',
      body: 'ESI monthly filing for Adani Enterprises — Mar 2026 has been escalated due to approaching deadline.',
      isRead: true,
      eventName: 'compliance-filings.escalated',
      entityType: 'compliance-filings',
      entityId: null,
      createdAt: daysAgo(3.6),
    },

    // ── This month (4) ───────────────────────────────────────────────
    {
      userId: admin.id,
      title: 'Bulk registration completed',
      body: '8 clients registered against 4 laws in the April 2026 onboarding batch.',
      isRead: true,
      eventName: 'clients.bulk-registered',
      entityType: 'clients',
      entityId: null,
      createdAt: daysAgo(8),
    },
    {
      userId: admin.id,
      title: 'Law amendment notice',
      body: 'The Companies (Amendment) Act 2026 takes effect 1 May 2026. 3 ROC rules impacted.',
      isRead: true,
      eventName: 'system.law-amendment',
      entityType: null,
      entityId: null,
      createdAt: daysAgo(11),
    },
    {
      userId: admin.id,
      title: '2 filings reassigned',
      body: 'GST-1 and GST-3B for Sun Pharma were reassigned from Anita Desai to you.',
      isRead: true,
      eventName: 'compliance-filings.bulk-reassigned',
      entityType: 'compliance-filings',
      entityId: null,
      createdAt: daysAgo(14),
    },
    {
      userId: admin.id,
      title: 'Role permissions updated',
      body: 'Permissions for the "Partner" role have been updated. Affected users will see changes on next sign-in.',
      isRead: true,
      eventName: 'system.rbac-updated',
      entityType: null,
      entityId: null,
      createdAt: daysAgo(18),
    },

    // ── Earlier (2) ──────────────────────────────────────────────────
    {
      userId: admin.id,
      title: 'Q3 audit completed',
      body: 'Internal audit for the Q3 FY2025-26 filings closed with no exceptions.',
      isRead: true,
      eventName: 'system.audit-closed',
      entityType: null,
      entityId: null,
      createdAt: daysAgo(38),
    },
    {
      userId: admin.id,
      title: 'Client archived',
      body: 'Go Airlines (India) Ltd was archived by the billing team. No active registrations remain.',
      isRead: true,
      eventName: 'clients.archived',
      entityType: 'clients',
      entityId: null,
      createdAt: daysAgo(52),
    },
  ];

  await database.db.insert(notifications).values(rows);
};
