import type { INestApplicationContext } from '@nestjs/common';
import type { SeedSource } from '@packages/database/seeder';
import type { Condition } from '@packages/common';
import { NotificationTemplatesService } from '@packages/notifications';
import { AutomationRuleService } from '@packages/automations';

/**
 * Stream B escalation seed: four schedule-driven rules that fire the three-
 * tier overdue cadence (T+0, T+3, T+7) against every task regardless of
 * `kind`. Rules are admin-editable after seeding — firms can narrow by kind,
 * priority, or template text in platform-ui/automations.
 *
 * triggerType is `schedule_once` so each tier fires exactly once per task
 * (`automation_sent_log` keys on `ruleId|entityType|entityId|targetDate`,
 * with `targetDate='9999-12-31'` for once-semantics). `schedule_recurring`
 * would re-send every scan until the task leaves the condition window, which
 * contradicts the "three emails max per task" invariant from Q19a.
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
