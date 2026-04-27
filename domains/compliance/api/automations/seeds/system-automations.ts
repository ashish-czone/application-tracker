import type { INestApplicationContext, LoggerService } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { Condition } from '@packages/common';
import { NotificationTemplatesService } from '@packages/notifications';
import { AutomationRuleService } from '@packages/automations';

/**
 * Stream B (escalation) and Stream D (digest) for compliance filings —
 * the rule + template set that turns the platform mechanism (scheduler
 * + org-walk resolvers + send_notification + send_compliance_filing_digest)
 * into the user-facing US-8.1 / US-8.2 behavior. Mirrors the tasks-addon
 * system seeds (`@packages/tasks/api/seeds/system.ts`) but bound to
 * `compliance-filings` and `compliance_filings.dueDate`.
 *
 * Why a system seed (not demo): without these rules the documented
 * V1 acceptance for US-8.1 / US-8.2 doesn't fire. They're load-bearing
 * for the compliance domain's operating contract and must be present
 * on a fresh install — admins can disable / retune individual rules but
 * the absence of the rule set is a defect, not a configuration choice.
 *
 * Idempotent — `findFirstByName` on each rule + template short-circuits
 * if the install already ran the seed.
 */

interface TemplateSeed {
  name: string;
  channel: 'email';
  subject: string;
  body: string;
}

const TEMPLATES: TemplateSeed[] = [
  {
    name: 'compliance-filing-overdue-tier-1-assignee',
    channel: 'email',
    subject: 'Filing due today: {{payload.title}}',
    body: [
      'Hi,',
      '',
      'Your compliance filing "{{payload.title}}" is due today ({{payload.dueDate}}).',
      'Please review and take action.',
      '',
      '— Automated reminder',
    ].join('\n'),
  },
  {
    name: 'compliance-filing-overdue-tier-1-team',
    channel: 'email',
    subject: 'Team filing due today: {{payload.title}}',
    body: [
      'Hi,',
      '',
      'The unassigned team filing "{{payload.title}}" is due today ({{payload.dueDate}}).',
      'Anyone on the team can claim it or assign an owner.',
      '',
      '— Automated reminder',
    ].join('\n'),
  },
  {
    name: 'compliance-filing-overdue-tier-2',
    channel: 'email',
    subject: 'Team escalation: filing "{{payload.title}}" is 3 days overdue',
    body: [
      'Hi,',
      '',
      'The compliance filing "{{payload.title}}" (due {{payload.dueDate}}) is three days overdue.',
      'As team head, please follow up with the assignee or reassign.',
      '',
      '— Automated reminder',
    ].join('\n'),
  },
  {
    name: 'compliance-filing-overdue-tier-3',
    channel: 'email',
    subject: 'Parent-unit escalation: filing "{{payload.title}}" is 7 days overdue',
    body: [
      'Hi,',
      '',
      'The compliance filing "{{payload.title}}" (due {{payload.dueDate}}) assigned to a team under your unit is seven days overdue.',
      'As parent-unit head, please intervene.',
      '',
      '— Automated reminder',
    ].join('\n'),
  },
  {
    name: 'compliance-filing-daily-digest',
    channel: 'email',
    subject: 'Your compliance filings ({{totalCount}})',
    body: [
      'Hi,',
      '',
      "Here's your compliance filing digest.",
      '',
      '{{#hasOverdue}}OVERDUE ({{overdueCount}}):',
      '{{#sections.overdue}}  — {{title}} (was due {{dueDate}})',
      '{{/sections.overdue}}',
      '{{/hasOverdue}}',
      '{{#hasThisWeek}}DUE THIS WEEK ({{thisWeekCount}}):',
      '{{#sections.thisWeek}}  — {{title}} (due {{dueDate}})',
      '{{/sections.thisWeek}}',
      '{{/hasThisWeek}}',
      '{{#hasNextWeek}}DUE NEXT WEEK ({{nextWeekCount}}):',
      '{{#sections.nextWeek}}  — {{title}} (due {{dueDate}})',
      '{{/sections.nextWeek}}',
      '{{/hasNextWeek}}',
      '— Automated daily digest',
    ].join('\n'),
  },
];

const NOT_TERMINAL_STATUS: Condition[] = [
  { field: 'status', operator: 'neq', value: 'completed' },
  { field: 'status', operator: 'neq', value: 'cancelled' },
];

interface RuleSeed {
  name: string;
  description: string;
  templateName: string;
  dayOffset: number;
  conditions: Condition[];
  users: Record<string, { strategy: string; config?: Record<string, unknown> }>;
}

const ESCALATION_RULES: RuleSeed[] = [
  {
    name: 'compliance-filing-overdue-tier-1-assignee',
    description: 'T+0 overdue reminder to the assignee of a directly-assigned compliance filing.',
    templateName: 'compliance-filing-overdue-tier-1-assignee',
    dayOffset: 0,
    conditions: [
      ...NOT_TERMINAL_STATUS,
      { field: 'assigneeId', operator: 'is_not_null' },
    ],
    users: { recipient: { strategy: 'entity_field', config: { field: 'assigneeId' } } },
  },
  {
    name: 'compliance-filing-overdue-tier-1-team',
    description: 'T+0 overdue broadcast to every team member when a filing has no individual assignee.',
    templateName: 'compliance-filing-overdue-tier-1-team',
    dayOffset: 0,
    conditions: [
      ...NOT_TERMINAL_STATUS,
      { field: 'assigneeId', operator: 'is_null' },
      { field: 'assigneeTeamId', operator: 'is_not_null' },
    ],
    users: { recipient: { strategy: 'org_unit_members', config: { unitField: 'assigneeTeamId' } } },
  },
  {
    name: 'compliance-filing-overdue-tier-2',
    description: 'T+3 escalation to the assigned team head when a filing remains open.',
    templateName: 'compliance-filing-overdue-tier-2',
    dayOffset: 3,
    conditions: [
      ...NOT_TERMINAL_STATUS,
      { field: 'assigneeTeamId', operator: 'is_not_null' },
    ],
    users: { recipient: { strategy: 'org_unit_head', config: { unitField: 'assigneeTeamId' } } },
  },
  {
    name: 'compliance-filing-overdue-tier-3',
    description: 'T+7 escalation to the parent-unit head when a filing remains open.',
    templateName: 'compliance-filing-overdue-tier-3',
    dayOffset: 7,
    conditions: [
      ...NOT_TERMINAL_STATUS,
      { field: 'assigneeTeamId', operator: 'is_not_null' },
    ],
    users: { recipient: { strategy: 'parent_unit_head', config: { unitField: 'assigneeTeamId' } } },
  },
];

const DIGEST_RULE_NAME = 'compliance-filing-daily-digest';

export const seedComplianceSystemAutomations = async (
  ctx: INestApplicationContext,
): Promise<void> => {
  const templatesService = ctx.get(NotificationTemplatesService);
  const ruleService = ctx.get(AutomationRuleService);
  const logger: LoggerService = new Logger('seedComplianceSystemAutomations');

  const templateIds: Record<string, string> = {};
  for (const template of TEMPLATES) {
    const existing = await templatesService.findFirstByName(template.name);
    templateIds[template.name] = existing
      ? existing.id
      : (await templatesService.create(template)).id;
  }

  for (const rule of ESCALATION_RULES) {
    const existing = await ruleService.findFirstByName(rule.name);
    if (existing) continue;

    await ruleService.create({
      name: rule.name,
      description: rule.description,
      triggerType: 'schedule_once',
      scheduleEntityType: 'compliance-filings',
      scheduleDateField: 'dueDate',
      scheduleDateOperator: 'after',
      scheduleDateAmounts: [rule.dayOffset],
      scheduleDateUnit: 'days',
      conditions: rule.conditions,
      actions: [
        {
          type: 'send_notification',
          users: rule.users,
          config: {
            channels: [{ channel: 'email', templateId: templateIds[rule.templateName] }],
          },
        },
      ],
    });
  }

  const existingDigest = await ruleService.findFirstByName(DIGEST_RULE_NAME);
  if (!existingDigest) {
    await ruleService.create({
      name: DIGEST_RULE_NAME,
      description: 'Daily 9am digest per user: overdue, due this week, and due next week compliance filings in the user\'s personal queue or the queue of any team they head.',
      triggerType: 'schedule_recurring',
      scheduleEntityType: 'users',
      scheduleHour: 9,
      scheduleDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      actions: [
        {
          type: 'send_compliance_filing_digest',
          users: { recipient: { strategy: 'entity_field', config: { field: 'id' } } },
          config: {
            channels: [{ channel: 'email', templateId: templateIds[DIGEST_RULE_NAME] }],
          },
        },
      ],
    });
  }

  logger.log?.('Compliance system automations seeded');
};
