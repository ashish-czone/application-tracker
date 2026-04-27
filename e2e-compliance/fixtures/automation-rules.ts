import { apiClient } from '../helpers/api-client';
import { uniqueName } from '../helpers/unique-name';

export type ActionConfig = {
  type: string;
  config?: Record<string, unknown>;
  users?: Record<string, unknown>;
  link?: { as: string };
};

export interface ScheduleRule {
  id: string;
  name: string;
  triggerType: string;
  scheduleEntityType: string | null;
  scheduleHour: number | null;
  isActive: boolean;
}

export interface CreateScheduleRuleOptions {
  name?: string;
  scheduleEntityType: string;
  scheduleHour?: number;
  scheduleDaysOfWeek?: number[];
  scheduleDateField?: string;
  scheduleDateOperator?: 'before' | 'after';
  scheduleDateAmounts?: number[];
  scheduleDateUnit?: 'days' | 'hours' | 'minutes';
  conditions?: Array<Record<string, unknown>>;
  actions?: ActionConfig[];
  isActive?: boolean;
}

/**
 * Creates a `schedule_recurring` automation rule via the API. Defaults
 * are sized for the e2e suite — minimal action set (one webhook stub),
 * no day-of-week restriction, no date conditions unless the caller
 * supplies them. Pass `scheduleEntityType` to bind the rule to an
 * entity table (e.g., `compliance-filings`) and `scheduleHour` to set
 * the firing hour in APP_TIMEZONE.
 */
export async function createScheduleRule(
  opts: CreateScheduleRuleOptions,
): Promise<ScheduleRule> {
  return apiClient.post<ScheduleRule>('/automation-rules', {
    name: opts.name ?? uniqueName('Rule'),
    triggerType: 'schedule_recurring',
    scheduleEntityType: opts.scheduleEntityType,
    scheduleHour: opts.scheduleHour ?? 2,
    scheduleDaysOfWeek: opts.scheduleDaysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
    scheduleDateField: opts.scheduleDateField,
    scheduleDateOperator: opts.scheduleDateOperator,
    scheduleDateAmounts: opts.scheduleDateAmounts,
    scheduleDateUnit: opts.scheduleDateUnit,
    conditions: opts.conditions ?? [],
    actions: opts.actions ?? [
      { type: 'webhook', config: { url: 'http://localhost:9999/e2e-noop' } },
    ],
    isActive: opts.isActive ?? true,
  });
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
}

/**
 * Creates a notification template via the API. The InAppChannel renders
 * `content.title` (from `subject`) and `content.body` (from `body`) into
 * the `notifications` table when the dispatcher is invoked with channel
 * `in_app`, regardless of the template's stored `channel` field — so a
 * single template created here can drive both `email` and `in_app` rule
 * channels for assertion purposes.
 */
export async function createNotificationTemplate(opts: {
  name?: string;
  channel?: 'email' | 'in_app' | 'whatsapp';
  subject?: string;
  body: string;
}): Promise<NotificationTemplate> {
  return apiClient.post<NotificationTemplate>('/notification-templates', {
    name: opts.name ?? uniqueName('Template'),
    channel: opts.channel ?? 'email',
    subject: opts.subject ?? 'E2E template',
    body: opts.body,
  });
}

/**
 * Builds a `schedule_recurring` rule + the matching template for the
 * compliance daily digest, returning both. The rule fires at the given
 * hour against `users` and dispatches via `send_compliance_filing_digest`
 * with both `email` and `in_app` channels (in-app is what the e2e spec
 * asserts against; email is included so the rule shape matches the
 * seeded `compliance-filing-daily-digest`).
 */
export async function createComplianceDigestRule(opts: {
  scheduleHour?: number;
  templateBody?: string;
} = {}): Promise<{ rule: ScheduleRule; template: NotificationTemplate }> {
  const template = await createNotificationTemplate({
    name: uniqueName('digest-template'),
    subject: 'Your filings ({{totalCount}})',
    body: opts.templateBody ?? [
      '{{#hasOverdue}}OVERDUE: {{#sections.overdue}}{{title}};{{/sections.overdue}}{{/hasOverdue}}',
      '{{#hasThisWeek}}WEEK: {{#sections.thisWeek}}{{title}};{{/sections.thisWeek}}{{/hasThisWeek}}',
      '{{#hasNextWeek}}NEXT: {{#sections.nextWeek}}{{title}};{{/sections.nextWeek}}{{/hasNextWeek}}',
    ].join('\n'),
  });

  const rule = await apiClient.post<ScheduleRule>('/automation-rules', {
    name: uniqueName('digest-rule'),
    triggerType: 'schedule_recurring',
    scheduleEntityType: 'users',
    scheduleHour: opts.scheduleHour ?? 9,
    scheduleDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    actions: [
      {
        type: 'send_compliance_filing_digest',
        users: { recipient: { strategy: 'entity_field', config: { field: 'id' } } },
        config: {
          channels: [
            { channel: 'in_app', templateId: template.id },
            { channel: 'email', templateId: template.id },
          ],
        },
      },
    ],
    isActive: true,
  });

  return { rule, template };
}

/**
 * Builds a `schedule_once` escalation rule + matching template against
 * `compliance-filings`. `dayOffset` controls the date condition (0 / 3
 * / 7 for the standard tiers) and `recipientStrategy` controls who the
 * notification is dispatched to:
 *
 *   - `entity_field` { field: 'assigneeId' } — direct assignee
 *   - `org_unit_head` { unitField: 'assigneeTeamId' } — head of assigned team
 *   - `parent_unit_head` { unitField: 'assigneeTeamId' } — parent-team head
 *   - `org_unit_members` { unitField: 'assigneeTeamId' } — every team member
 *
 * Mirrors the seeded `compliance-filing-overdue-tier-*` rule shape but
 * adds an `in_app` channel alongside `email` so the e2e spec can assert
 * dispatch via the test-hooks notification endpoint.
 */
export async function createComplianceEscalationRule(opts: {
  dayOffset: number;
  recipientStrategy: 'entity_field' | 'org_unit_head' | 'parent_unit_head' | 'org_unit_members';
  recipientField?: string;
  conditions?: Array<Record<string, unknown>>;
  templateBody?: string;
}): Promise<{ rule: ScheduleRule; template: NotificationTemplate }> {
  const template = await createNotificationTemplate({
    name: uniqueName('escalation-template'),
    subject: 'Filing overdue: {{payload.title}}',
    body: opts.templateBody ?? 'Filing "{{payload.title}}" overdue ({{payload.dueDate}})',
  });

  const recipientField = opts.recipientField
    ?? (opts.recipientStrategy === 'entity_field' ? 'assigneeId' : 'assigneeTeamId');
  const recipientConfig = opts.recipientStrategy === 'entity_field'
    ? { field: recipientField }
    : { unitField: recipientField };

  const rule = await apiClient.post<ScheduleRule>('/automation-rules', {
    name: uniqueName(`escalation-t${opts.dayOffset}`),
    triggerType: 'schedule_once',
    scheduleEntityType: 'compliance-filings',
    scheduleDateField: 'dueDate',
    scheduleDateOperator: 'after',
    scheduleDateAmounts: [opts.dayOffset],
    scheduleDateUnit: 'days',
    conditions: opts.conditions ?? [
      { field: 'status', operator: 'neq', value: 'completed' },
      { field: 'status', operator: 'neq', value: 'cancelled' },
    ],
    actions: [
      {
        type: 'send_notification',
        users: {
          recipient: { strategy: opts.recipientStrategy, config: recipientConfig },
        },
        config: {
          channels: [
            { channel: 'in_app', templateId: template.id },
            { channel: 'email', templateId: template.id },
          ],
        },
      },
    ],
    isActive: true,
  });

  return { rule, template };
}
