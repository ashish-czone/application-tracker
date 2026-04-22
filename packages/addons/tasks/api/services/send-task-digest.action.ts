import { Injectable } from '@nestjs/common';
import Mustache from 'mustache';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, and, eq, isNull, or, sql } from '@packages/database';
import { todayInTimezone } from '@packages/common';
import { withTenant } from '@packages/tenancy/helpers';
import { orgUnitMembers } from '@packages/org-units';
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
import { tasks } from '../schema/tasks';

interface ChannelConfig {
  channel: NotificationChannel;
  templateId: string;
}

interface DigestTaskRow {
  id: string;
  title: string;
  dueDate: string | null;
}

interface DigestSections {
  overdue: DigestTaskRow[];
  today: DigestTaskRow[];
  thisWeek: DigestTaskRow[];
}

/**
 * Daily task digest for the iterated user. Called by ScheduleScanner when a
 * schedule_recurring rule targets `users` and lists this action handler.
 *
 * Buckets tasks in the user's personal queue (Q16 semantics: tasks assigned
 * directly + unassigned in a team the user belongs to) into overdue /
 * due today / due within the next 7 days, renders one email per configured
 * channel, and short-circuits when every bucket is empty (Q18).
 */
@Injectable()
export class SendTaskDigestAction implements ActionHandler {
  readonly type = 'send_task_digest';
  readonly label = 'Send Task Digest';
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
    this.logger = appLogger.forContext(SendTaskDigestAction.name);
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

    for (const userId of recipients) {
      const sections = await this.buildSections(userId);
      if (
        sections.overdue.length === 0 &&
        sections.today.length === 0 &&
        sections.thisWeek.length === 0
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

  private async buildSections(userId: string): Promise<DigestSections> {
    const today = todayInTimezone(this.appTimezone);
    const in7Days = this.addIsoDays(today, 7);

    const rows = await this.database.db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate })
      .from(tasks)
      .where(withTenant(
        tasks,
        sql`${tasks.status} NOT IN ('completed', 'cancelled')`,
        sql`${tasks.dueDate} IS NOT NULL`,
        sql`${tasks.dueDate} <= ${in7Days}`,
        or(
          eq(tasks.assigneeId, userId),
          and(
            isNull(tasks.assigneeId),
            sql`${tasks.assigneeTeamId} IN (SELECT ${orgUnitMembers.orgUnitId} FROM ${orgUnitMembers} WHERE ${orgUnitMembers.userId} = ${userId})`,
          ),
        )!,
      ));

    const overdue: DigestTaskRow[] = [];
    const dueToday: DigestTaskRow[] = [];
    const thisWeek: DigestTaskRow[] = [];

    for (const row of rows as DigestTaskRow[]) {
      if (!row.dueDate) continue;
      if (row.dueDate < today) overdue.push(row);
      else if (row.dueDate === today) dueToday.push(row);
      else thisWeek.push(row);
    }

    const byDueDateThenTitle = (a: DigestTaskRow, b: DigestTaskRow) =>
      (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.title.localeCompare(b.title);
    overdue.sort(byDueDateThenTitle);
    dueToday.sort(byDueDateThenTitle);
    thisWeek.sort(byDueDateThenTitle);

    return { overdue, today: dueToday, thisWeek };
  }

  private renderDigest(template: NotificationTemplate, sections: DigestSections): RenderedNotification {
    const context = {
      sections,
      hasOverdue: sections.overdue.length > 0,
      hasToday: sections.today.length > 0,
      hasThisWeek: sections.thisWeek.length > 0,
      overdueCount: sections.overdue.length,
      todayCount: sections.today.length,
      thisWeekCount: sections.thisWeek.length,
      totalCount: sections.overdue.length + sections.today.length + sections.thisWeek.length,
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
