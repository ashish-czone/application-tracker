import type { INestApplicationContext } from '@nestjs/common';
import type { SeedSource } from '@packages/database/seeder';
import type { Condition } from '@packages/common';
import { NotificationTemplatesService } from '@packages/notifications';
import { AutomationRuleService } from '@packages/automations';

/**
 * Task system seed — two groups, both admin-editable after install:
 *
 * 1. Stream B escalation rules (T+0 assignee / T+0 team / T+3 team head /
 *    T+7 parent-unit head). All four use `schedule_once` so each tier
 *    fires exactly once per task — `automation_sent_log` dedupes on
 *    `(rule, entity, targetDate='9999-12-31')`. `schedule_recurring` would
 *    re-send every scan until the task left the date window, which
 *    contradicts Q19a's "three emails max per task" invariant.
 *
 * 2. Stream D daily-digest rule — `schedule_recurring` against `users` at
 *    9am APP_TIMEZONE (Q17) with `send_task_digest` action. Digest content
 *    composition lives in SendTaskDigestAction; this seed only wires the
 *    schedule.
 */

interface TemplateSeed {
  name: string;
  channel: 'email';
  subject: string;
  body: string;
}

const TEMPLATES: TemplateSeed[] = [
  {
    name: 'task-overdue-tier-1-assignee',
    channel: 'email',
    subject: 'Task due today: {{payload.title}}',
    body: [
      'Hi,',
      '',
      'Your task "{{payload.title}}" is due today ({{payload.dueDate}}).',
      'Please review and take action.',
      '',
      '— Automated reminder',
    ].join('\n'),
  },
  {
    name: 'task-overdue-tier-1-team',
    channel: 'email',
    subject: 'Team task due today: {{payload.title}}',
    body: [
      'Hi,',
      '',
      'The unassigned team task "{{payload.title}}" is due today ({{payload.dueDate}}).',
      'Anyone on the team can claim it or assign an owner.',
      '',
      '— Automated reminder',
    ].join('\n'),
  },
  {
    name: 'task-overdue-tier-2',
    channel: 'email',
    subject: 'Team escalation: "{{payload.title}}" is 3 days overdue',
    body: [
      'Hi,',
      '',
      'The team task "{{payload.title}}" (due {{payload.dueDate}}) is three days overdue.',
      'As team head, please follow up with the assignee or reassign.',
      '',
      '— Automated reminder',
    ].join('\n'),
  },
  {
    name: 'task-overdue-tier-3',
    channel: 'email',
    subject: 'Parent-unit escalation: "{{payload.title}}" is 7 days overdue',
    body: [
      'Hi,',
      '',
      'The task "{{payload.title}}" (due {{payload.dueDate}}) assigned to a team under your unit is seven days overdue.',
      'As parent-unit head, please intervene.',
      '',
      '— Automated reminder',
    ].join('\n'),
  },
  {
    name: 'task-daily-digest',
    channel: 'email',
    subject: 'Your tasks today ({{totalCount}})',
    body: [
      'Hi,',
      '',
      "Here's your task digest for today.",
      '',
      '{{#hasOverdue}}OVERDUE ({{overdueCount}}):',
      '{{#sections.overdue}}  — {{title}} (was due {{dueDate}})',
      '{{/sections.overdue}}',
      '{{/hasOverdue}}',
      '{{#hasToday}}DUE TODAY ({{todayCount}}):',
      '{{#sections.today}}  — {{title}} (due {{dueDate}})',
      '{{/sections.today}}',
      '{{/hasToday}}',
      '{{#hasThisWeek}}DUE THIS WEEK ({{thisWeekCount}}):',
      '{{#sections.thisWeek}}  — {{title}} (due {{dueDate}})',
      '{{/sections.thisWeek}}',
      '{{/hasThisWeek}}',
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

const RULES: RuleSeed[] = [
  {
    name: 'task-overdue-tier-1-assignee',
    description: 'T+0 overdue reminder to the assignee of a directly-assigned task.',
    templateName: 'task-overdue-tier-1-assignee',
    dayOffset: 0,
    conditions: [
      ...NOT_TERMINAL_STATUS,
      { field: 'assigneeId', operator: 'is_not_null' },
    ],
    users: { recipient: { strategy: 'entity_field', config: { field: 'assigneeId' } } },
  },
  {
    name: 'task-overdue-tier-1-team',
    description: 'T+0 overdue broadcast to every team member when a task has no individual assignee.',
    templateName: 'task-overdue-tier-1-team',
    dayOffset: 0,
    conditions: [
      ...NOT_TERMINAL_STATUS,
      { field: 'assigneeId', operator: 'is_null' },
      { field: 'assigneeTeamId', operator: 'is_not_null' },
    ],
    users: { recipient: { strategy: 'org_unit_members', config: { unitField: 'assigneeTeamId' } } },
  },
  {
    name: 'task-overdue-tier-2',
    description: 'T+3 escalation to the assigned team head when a task remains open.',
    templateName: 'task-overdue-tier-2',
    dayOffset: 3,
    conditions: [
      ...NOT_TERMINAL_STATUS,
      { field: 'assigneeTeamId', operator: 'is_not_null' },
    ],
    users: { recipient: { strategy: 'org_unit_head', config: { unitField: 'assigneeTeamId' } } },
  },
  {
    name: 'task-overdue-tier-3',
    description: 'T+7 escalation to the parent-unit head when a task remains open.',
    templateName: 'task-overdue-tier-3',
    dayOffset: 7,
    conditions: [
      ...NOT_TERMINAL_STATUS,
      { field: 'assigneeTeamId', operator: 'is_not_null' },
    ],
    users: { recipient: { strategy: 'parent_unit_head', config: { unitField: 'assigneeTeamId' } } },
  },
];

export const seedSystem = async (ctx: INestApplicationContext): Promise<void> => {
  const templatesService = ctx.get(NotificationTemplatesService);
  const ruleService = ctx.get(AutomationRuleService);

  const templateIds: Record<string, string> = {};
  for (const template of TEMPLATES) {
    const existing = await templatesService.findFirstByName(template.name);
    templateIds[template.name] = existing
      ? existing.id
      : (await templatesService.create(template)).id;
  }

  for (const rule of RULES) {
    const existing = await ruleService.findFirstByName(rule.name);
    if (existing) continue;

    await ruleService.create({
      name: rule.name,
      description: rule.description,
      triggerType: 'schedule_once',
      scheduleEntityType: 'tasks',
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

  // Stream D — daily digest. One rule per user per day, 9am APP_TIMEZONE
  // (Q17). `users` is already a valid scheduleEntityType because users goes
  // through defineEntity() in @packages/users; no extra registration needed.
  const digestRuleName = 'task-daily-digest';
  const existingDigest = await ruleService.findFirstByName(digestRuleName);
  if (!existingDigest) {
    await ruleService.create({
      name: digestRuleName,
      description: 'Daily 9am digest per user: overdue, due today, and due this week in their personal queue.',
      triggerType: 'schedule_recurring',
      scheduleEntityType: 'users',
      scheduleHour: 9,
      scheduleDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      actions: [
        {
          type: 'send_task_digest',
          users: { recipient: { strategy: 'entity_field', config: { field: 'id' } } },
          config: {
            channels: [{ channel: 'email', templateId: templateIds['task-daily-digest'] }],
          },
        },
      ],
    });
  }
};

/**
 * Seed source list for apps that mount `TasksModule`. Tasks is an addon, so
 * it is not included in `platformSystemSeedSources()`. Apps that depend on
 * tasks must spread this into their own seed.ts CLI.
 */
export function tasksSystemSeedSources(): SeedSource[] {
  return [
    {
      name: '@packages/tasks',
      kind: 'system',
      load: async () => seedSystem,
    },
  ];
}
