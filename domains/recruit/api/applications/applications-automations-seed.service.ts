import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { automationRules } from '@packages/automations';
import { notificationTemplates } from '@packages/notifications/schema';
import type { ActionConfig } from '@packages/automations';
import type { Condition } from '@packages/common';

/** In-app notification templates for stage-change automations */
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

const INTERVIEW_STAGES = ['phone-screen', 'technical', 'on-site', 'final'];

@Injectable()
export class ApplicationsAutomationsSeedService implements OnApplicationBootstrap {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ApplicationsAutomationsSeedService.name);
  }

  async onApplicationBootstrap() {
    await this.seed();
  }

  private async seed() {
    // Skip if automation rules already exist for this event
    const [existing] = await this.database.db
      .select({ id: automationRules.id })
      .from(automationRules)
      .where(withTenant(automationRules))
      .limit(1);

    if (existing) return;

    this.logger.log('Seeding stage-change automation rules...');

    // Create notification templates
    const templateIds = await this.createTemplates();

    // Create automation rules
    await this.createRules(templateIds);

    this.logger.log('Stage-change automation rules seeded successfully');
  }

  private async createTemplates(): Promise<{ interview: string; offer: string; hired: string }> {
    const results: string[] = [];

    for (const template of TEMPLATES) {
      const [row] = await this.database.db
        .insert(notificationTemplates)
        .values(withTenantInsert(notificationTemplates, template))
        .returning();
      results.push(row.id);
    }

    return { interview: results[0], offer: results[1], hired: results[2] };
  }

  private async createRules(templateIds: { interview: string; offer: string; hired: string }) {
    const rules = [
      this.buildInterviewStageRule(templateIds.interview),
      this.buildOfferStageRule(templateIds.offer),
      this.buildHiredStageRule(templateIds.hired),
    ];

    for (const rule of rules) {
      await this.database.db
        .insert(automationRules)
        .values(withTenantInsert(automationRules, rule));
    }
  }

  /**
   * Rule 1: When application moves to an interview stage,
   * notify the hiring manager and interviewers.
   */
  private buildInterviewStageRule(templateId: string) {
    const conditions: Condition[] = [
      { field: 'toState', operator: 'in', value: INTERVIEW_STAGES },
    ];

    const actions: ActionConfig[] = [
      {
        type: 'send_notification',
        config: {
          channels: [{ channel: 'in_app', templateId }],
        },
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
        config: {
          channels: [{ channel: 'in_app', templateId }],
        },
        users: {
          recipient: {
            strategy: 'application_interviewers',
          },
        },
      },
    ];

    return {
      name: 'Notify on interview stage',
      description: 'Sends in-app notification to the hiring manager and interviewers when an application moves to an interview stage (phone screen, technical, on-site, or final).',
      triggerType: 'event',
      eventName: 'applications.StageChanged',
      conditions,
      actions,
    };
  }

  /**
   * Rule 2: When application reaches the offer stage,
   * notify the hiring manager.
   */
  private buildOfferStageRule(templateId: string) {
    const conditions: Condition[] = [
      { field: 'toState', operator: 'eq', value: 'offer' },
    ];

    const actions: ActionConfig[] = [
      {
        type: 'send_notification',
        config: {
          channels: [{ channel: 'in_app', templateId }],
        },
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
      eventName: 'applications.StageChanged',
      conditions,
      actions,
    };
  }

  /**
   * Rule 3: When application reaches the hired stage,
   * notify the hiring manager.
   */
  private buildHiredStageRule(templateId: string) {
    const conditions: Condition[] = [
      { field: 'toState', operator: 'eq', value: 'hired' },
    ];

    const actions: ActionConfig[] = [
      {
        type: 'send_notification',
        config: {
          channels: [{ channel: 'in_app', templateId }],
        },
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
      eventName: 'applications.StageChanged',
      conditions,
      actions,
    };
  }
}
