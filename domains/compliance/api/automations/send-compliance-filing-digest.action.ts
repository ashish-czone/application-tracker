import { Injectable } from '@nestjs/common';
import Mustache from 'mustache';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, sql, withScope } from '@packages/database';
import { todayInTimezone } from '@packages/common';
import type {
  ActionHandler,
  ActionContext,
  ActionResult,
  UserSlotDefinition,
} from '@packages/automation-contracts';
import {
  NotificationTemplatesService,
  NotificationDispatcher,
  PreferenceService,
  type NotificationChannel,
  type NotificationTemplate,
  type RenderedNotification,
} from '@packages/notifications';
import { complianceFilings } from '../schema/compliance-filings';

interface ChannelConfig {
  channel: NotificationChannel;
  templateId: string;
}

interface DigestFilingRow {
  id: string;
  title: string;
  dueDate: string | null;
}

interface DigestSections {
  overdue: DigestFilingRow[];
  thisWeek: DigestFilingRow[];
  nextWeek: DigestFilingRow[];
}

/**
 * Daily compliance-filing digest for the iterated user. Scheduled rule
 * iterates `users` once per day (US-8.1 / scheduleHour: 9) and invokes
 * this action with the user's id resolved into the `recipient` slot.
 *
 * Recipient model (US-8.1):
 *   - filings where `assigneeId = userId` (direct assignments), OR
 *   - filings where `assigneeId IS NULL` AND `userId` is the head of
 *     `assigneeTeamId`. "Head" = the member of the unit holding the
 *     position with the lowest `sortOrder` — same definition the
 *     `org_unit_head` resolver uses for escalation, kept consistent so
 *     digest and escalation always point at the same person.
 *
 * Bucket boundaries (US-8.1):
 *   - Overdue:    dueDate < today
 *   - This week:  today <= dueDate <= today + 7
 *   - Next week:  today + 8 <= dueDate <= today + 14
 * Filings further out are not surfaced — the digest is a near-term
 * focus list, not a full backlog.
 *
 * Short-circuits when every bucket is empty (no email for users with
 * nothing to do).
 */
@Injectable()
export class SendComplianceFilingDigestAction implements ActionHandler {
  readonly type = 'send_compliance_filing_digest';
  readonly label = 'Send Compliance Filing Digest';
  readonly userSlots: UserSlotDefinition[] = [
    { name: 'recipient', label: 'Recipient', required: true },
  ];
  readonly configSchema = {
    channels: {
      type: 'array',
      required: true,
      label: 'Channels',
      items: {
        channel: { type: 'enum', options: ['email', 'in_app', 'whatsapp'], label: 'Channel' },
        templateId: { type: 'string', label: 'Template' },
      },
    },
  };

  private readonly logger: ContextLogger;
  private readonly appTimezone: string;

  constructor(
    private readonly database: DatabaseService,
    private readonly templatesService: NotificationTemplatesService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly preferenceService: PreferenceService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(SendComplianceFilingDigestAction.name);
    this.appTimezone = process.env.APP_TIMEZONE ?? 'UTC';
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const channels = context.actionConfig.config.channels as ChannelConfig[] | undefined;
    if (!channels?.length) return {};

    const recipients = context.resolvedUsers.recipient ?? [];
    if (recipients.length === 0) return {};

    const channelContext = {
      eventName: context.event?.eventName ?? '',
      entityType: context.event?.entityType ?? '',
      entityId: context.event?.entityId ?? '',
      correlationId: context.event?.correlationId ?? '',
    };

    const now = context.now ?? new Date();

    for (const userId of recipients) {
      const sections = await this.buildSections(userId, now);
      if (
        sections.overdue.length === 0 &&
        sections.thisWeek.length === 0 &&
        sections.nextWeek.length === 0
      ) {
        continue;
      }

      for (const channelConfig of channels) {
        const template = await this.templatesService
          .findByIdOrFail(channelConfig.templateId)
          .catch(() => null);
        if (!template) {
          this.logger.warn('Template not found — skipping digest channel', {
            templateId: channelConfig.templateId,
            channel: channelConfig.channel,
          });
          continue;
        }

        const enabled = await this.preferenceService.isEnabled(userId, channelConfig.channel);
        if (!enabled) continue;

        const content = this.renderDigest(template, sections);
        await this.dispatcher.dispatch(
          channelConfig.channel,
          userId,
          content,
          channelContext,
        );
      }
    }

    return {};
  }

  private async buildSections(userId: string, now: Date): Promise<DigestSections> {
    const today = todayInTimezone(this.appTimezone, now);
    const in14Days = this.addIsoDays(today, 14);

    // "Head of team" subquery: units where this user holds the
    // lowest-sortOrder position. Mirrors the org_unit_head resolver's
    // semantics so digest recipients line up with escalation recipients.
    const rows = await this.database.db
      .select({ id: complianceFilings.id, title: complianceFilings.title, dueDate: complianceFilings.dueDate })
      .from(complianceFilings)
      .where(withScope(
        complianceFilings,
        sql`${complianceFilings.status} NOT IN ('completed', 'cancelled')`,
        sql`${complianceFilings.dueDate} IS NOT NULL`,
        sql`${complianceFilings.dueDate} <= ${in14Days}`,
        sql`(
          ${complianceFilings.assigneeId} = ${userId}
          OR (
            ${complianceFilings.assigneeId} IS NULL
            AND ${complianceFilings.assigneeTeamId} IN (
              SELECT oum.org_unit_id
              FROM org_unit_members oum
              INNER JOIN org_positions op ON op.id = oum.position_id
              WHERE oum.user_id = ${userId}
                AND op.sort_order = (
                  SELECT MIN(op2.sort_order)
                  FROM org_unit_members oum2
                  INNER JOIN org_positions op2 ON op2.id = oum2.position_id
                  WHERE oum2.org_unit_id = oum.org_unit_id
                )
            )
          )
        )`,
      ));

    const overdue: DigestFilingRow[] = [];
    const thisWeek: DigestFilingRow[] = [];
    const nextWeek: DigestFilingRow[] = [];
    const in7Days = this.addIsoDays(today, 7);
    const in8Days = this.addIsoDays(today, 8);

    for (const row of rows as DigestFilingRow[]) {
      if (!row.dueDate) continue;
      if (row.dueDate < today) overdue.push(row);
      else if (row.dueDate <= in7Days) thisWeek.push(row);
      else if (row.dueDate >= in8Days && row.dueDate <= in14Days) nextWeek.push(row);
    }

    const byDueDateThenTitle = (a: DigestFilingRow, b: DigestFilingRow) =>
      (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.title.localeCompare(b.title);
    overdue.sort(byDueDateThenTitle);
    thisWeek.sort(byDueDateThenTitle);
    nextWeek.sort(byDueDateThenTitle);

    return { overdue, thisWeek, nextWeek };
  }

  private renderDigest(template: NotificationTemplate, sections: DigestSections): RenderedNotification {
    const context = {
      sections,
      hasOverdue: sections.overdue.length > 0,
      hasThisWeek: sections.thisWeek.length > 0,
      hasNextWeek: sections.nextWeek.length > 0,
      overdueCount: sections.overdue.length,
      thisWeekCount: sections.thisWeek.length,
      nextWeekCount: sections.nextWeek.length,
      totalCount: sections.overdue.length + sections.thisWeek.length + sections.nextWeek.length,
    };
    const title = template.subject ? Mustache.render(template.subject, context) : template.name;
    return {
      title,
      body: Mustache.render(template.body, context),
      subject: template.subject ? title : undefined,
    };
  }

  private addIsoDays(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
}
