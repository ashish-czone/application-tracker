import type { INestApplicationContext, LoggerService } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { AutomationRuleService } from '@packages/automations';
import { NotificationTemplatesService } from '@packages/notifications';
import type { ActionConfig } from '@packages/automations';
import type { Condition } from '@packages/common';

const INTERVIEW_STAGES = ['phone-screen', 'technical', 'on-site', 'final'];
const STAGE_CHANGED_EVENT = 'applications.StageChanged';

const TEMPLATES = [
  {
    name: 'Application moved to interview stage',
    channel: 'in_app' as const,
    subject: 'Application moved to {{payload.toState}}',
    body: 'An application ({{event.entityId}}) has been moved to the {{payload.toState}} stage.',
  },
  {
    name: 'Application reached offer stage',
    channel: 'in_app' as const,
    subject: 'Application moved to Offer stage',
    body: 'An application ({{event.entityId}}) has reached the Offer stage. Consider preparing an offer.',
  },
  {
    name: 'Candidate hired',
    channel: 'in_app' as const,
    subject: 'Candidate hired!',
    body: 'An application ({{event.entityId}}) has been moved to Hired. The position count has been updated.',
  },
];

export const seedDemoAutomations = async (ctx: INestApplicationContext): Promise<void> => {
  const automationRuleService = ctx.get(AutomationRuleService);
  const templateService = ctx.get(NotificationTemplatesService);
  const logger: LoggerService = new Logger('seedDemoAutomations');

  const existing = await automationRuleService.list({
    eventName: STAGE_CHANGED_EVENT,
    limit: 1,
  });
  if (existing.meta.total > 0) {
    logger.log?.('Stage-change automation rules already present — skipping');
    return;
  }

  logger.log?.('Seeding stage-change notification templates + automation rules...');

  const [interviewTpl, offerTpl, hiredTpl] = await Promise.all(
    TEMPLATES.map((t) => templateService.create(t)),
  );

  await automationRuleService.create(buildInterviewStageRule(interviewTpl.id));
  await automationRuleService.create(buildOfferStageRule(offerTpl.id));
  await automationRuleService.create(buildHiredStageRule(hiredTpl.id));

  logger.log?.('Stage-change automation rules seeded');
};

function buildInterviewStageRule(templateId: string) {
  const conditions: Condition[] = [
    { field: 'toState', operator: 'in', value: INTERVIEW_STAGES },
  ];
  const actions: ActionConfig[] = [
    {
      type: 'send_notification',
      config: { channels: [{ channel: 'in_app', templateId }] },
      users: {
        recipient: {
          strategy: 'related_entity_field',
          config: {
            throughField: 'jobOpeningId',
            throughEntityType: 'job_openings',
            targetField: 'hiringManager',
          },
        },
      },
    },
    {
      type: 'send_notification',
      config: { channels: [{ channel: 'in_app', templateId }] },
      users: {
        recipient: { strategy: 'application_interviewers' },
      },
    },
  ];
  return {
    name: 'Notify on interview stage',
    description: 'Sends in-app notification to the hiring manager and interviewers when an application moves to an interview stage (phone screen, technical, on-site, or final).',
    triggerType: 'event',
    eventName: STAGE_CHANGED_EVENT,
    conditions,
    actions,
  };
}

function buildOfferStageRule(templateId: string) {
  const conditions: Condition[] = [
    { field: 'toState', operator: 'eq', value: 'offer' },
  ];
  const actions: ActionConfig[] = [
    {
      type: 'send_notification',
      config: { channels: [{ channel: 'in_app', templateId }] },
      users: {
        recipient: {
          strategy: 'related_entity_field',
          config: {
            throughField: 'jobOpeningId',
            throughEntityType: 'job_openings',
            targetField: 'hiringManager',
          },
        },
      },
    },
  ];
  return {
    name: 'Notify hiring manager on offer',
    description: 'Sends in-app notification to the hiring manager when an application reaches the Offer stage.',
    triggerType: 'event',
    eventName: STAGE_CHANGED_EVENT,
    conditions,
    actions,
  };
}

function buildHiredStageRule(templateId: string) {
  const conditions: Condition[] = [
    { field: 'toState', operator: 'eq', value: 'hired' },
  ];
  const actions: ActionConfig[] = [
    {
      type: 'send_notification',
      config: { channels: [{ channel: 'in_app', templateId }] },
      users: {
        recipient: {
          strategy: 'related_entity_field',
          config: {
            throughField: 'jobOpeningId',
            throughEntityType: 'job_openings',
            targetField: 'hiringManager',
          },
        },
      },
    },
  ];
  return {
    name: 'Notify hiring manager on hire',
    description: 'Sends in-app notification to the hiring manager when an application reaches the Hired stage.',
    triggerType: 'event',
    eventName: STAGE_CHANGED_EVENT,
    conditions,
    actions,
  };
}
