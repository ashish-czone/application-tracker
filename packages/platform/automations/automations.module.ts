import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { QueueService } from '@packages/queue';
import { RbacService } from '@packages/rbac';
import { DatabaseService } from '@packages/database';
import { cronForLocalHour } from '@packages/common';
import { AUTOMATIONS_EXTENSION } from '@packages/entity-engine/extensions';
import type { DomainEvent } from '@packages/events';
import { AutomationRuleService } from './services/automation-rule.service';
import { AutomationListener } from './listeners/automation.listener';
import { AutomationsCleanupListener } from './listeners/automations-cleanup.listener';
import { ActionRegistry } from './services/action-registry';
import { UserResolverRegistry } from './services/user-resolver-registry';
import { EntityResolverRegistry } from './services/entity-resolver-registry';
import { ProvenanceService } from './services/provenance.service';
import { ExecutionLogService } from './services/execution-log.service';
import { LifecycleEngine } from './services/lifecycle-engine';
import { ScheduleScanner } from './services/schedule-scanner';
import { ActorStrategy } from './services/strategies/actor.strategy';
import { EntityFieldStrategy } from './services/strategies/entity-field.strategy';
import { RoleStrategy } from './services/strategies/role.strategy';
import { RelatedEntityFieldStrategy } from './services/strategies/related-entity-field.strategy';
import { AutomationRulesController } from './controllers/automation-rules.controller';
import { AutomationExecutionsController } from './controllers/automation-executions.controller';
import { AutomationsMetadataController } from './controllers/automations-metadata.controller';
import { WebhookAction, WEBHOOK_QUEUE_NAME } from './services/actions/webhook.action';
import { AutomationsExtensionAdapter } from './automations-extension.adapter';

export const AUTOMATION_SCHEDULE_SCAN_QUEUE = 'automation.schedule-scan';
export const AUTOMATION_EXECUTION_QUEUE = 'automation.execution';
export const AUTOMATION_EXECUTION_CLEANUP_QUEUE = 'automation.execution-cleanup';

@Global()
@Module({
  controllers: [AutomationRulesController, AutomationExecutionsController, AutomationsMetadataController],
  providers: [
    AutomationRuleService,
    AutomationListener,
    ActionRegistry,
    UserResolverRegistry,
    EntityResolverRegistry,
    ProvenanceService,
    ExecutionLogService,
    LifecycleEngine,
    ScheduleScanner,
    WebhookAction,
    AutomationsCleanupListener,
    AutomationsExtensionAdapter,
    {
      provide: AUTOMATIONS_EXTENSION,
      useExisting: AutomationsExtensionAdapter,
    },
  ],
  exports: [
    ActionRegistry,
    UserResolverRegistry,
    EntityResolverRegistry,
    AutomationRuleService,
    ProvenanceService,
    ExecutionLogService,
    AUTOMATIONS_EXTENSION,
  ],
})
export class AutomationsModule implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly userResolverRegistry: UserResolverRegistry,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    private readonly queueService: QueueService,
    private readonly scheduleScanner: ScheduleScanner,
    private readonly rbacService: RbacService,
    private readonly database: DatabaseService,
    private readonly webhookAction: WebhookAction,
    private readonly automationListener: AutomationListener,
    private readonly ruleService: AutomationRuleService,
    private readonly executionLogService: ExecutionLogService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(AutomationsModule.name);
  }

  async onModuleInit() {
    // Register RBAC permissions
    this.rbacService.registerPermissions('automations', [
      { action: 'rules.read', description: 'View automation rules' },
      { action: 'rules.manage', description: 'Create, update, and delete automation rules' },
    ]);

    // Register built-in user resolver strategies
    this.userResolverRegistry.registerStrategy(new ActorStrategy());
    this.userResolverRegistry.registerStrategy(
      new EntityFieldStrategy(this.database, (entityType) => this.entityResolverRegistry.get(entityType)),
    );
    this.userResolverRegistry.registerStrategy(new RoleStrategy(this.database));
    this.userResolverRegistry.registerStrategy(
      new RelatedEntityFieldStrategy(this.database, (entityType) => this.entityResolverRegistry.get(entityType)),
    );

    // Register schedule scanner cron job
    this.queueService.registerProcessor({
      name: AUTOMATION_SCHEDULE_SCAN_QUEUE,
      handler: async () => {
        await this.scheduleScanner.scan();
      },
    });

    const queue = this.queueService.getQueue(AUTOMATION_SCHEDULE_SCAN_QUEUE);
    if (queue) {
      const appTimezone = process.env.APP_TIMEZONE ?? 'UTC';
      const cronPattern = cronForLocalHour(2, appTimezone);
      try {
        await queue.upsertJobScheduler(
          'automation-schedule-scan',
          { pattern: cronPattern },
          { name: AUTOMATION_SCHEDULE_SCAN_QUEUE, data: {} },
        );
        this.logger.log(`Automation schedule scanner registered (${cronPattern}, 2:00 AM ${appTimezone})`);
      } catch (err) {
        this.logger.error('Failed to register schedule scanner', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Register built-in action handlers
    this.actionRegistry.register(this.webhookAction);

    // Register webhook queue processor
    this.queueService.registerProcessor({
      name: WEBHOOK_QUEUE_NAME,
      handler: async (data) => {
        const { url, method, headers, body, ruleId, correlationId } = data as {
          url: string; method: string; headers: Record<string, string>;
          body: unknown; ruleId: string; correlationId?: string;
        };
        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Webhook failed: ${response.status} ${text.slice(0, 200)}`);
        }
        this.logger.debug('Webhook delivered', { url, status: response.status, ruleId, correlationId });
      },
    });

    // Register automation execution queue processor
    // Used by schedule scanner to execute matched rule×entity pairs via Bull workers
    this.queueService.registerProcessor({
      name: AUTOMATION_EXECUTION_QUEUE,
      handler: async (data) => {
        const { ruleId, event } = data as { ruleId: string; event: DomainEvent };

        const rule = await this.ruleService.findByIdOrFail(ruleId).catch(() => null);
        if (!rule || !rule.isActive) {
          this.logger.debug('Skipping execution — rule inactive or deleted', { ruleId });
          return;
        }

        await this.automationListener.executeActions(rule, event);
      },
    });

    // Register execution log cleanup cron (daily at 3:00 AM, deletes entries older than 90 days)
    this.queueService.registerProcessor({
      name: AUTOMATION_EXECUTION_CLEANUP_QUEUE,
      handler: async () => {
        await this.executionLogService.deleteOlderThan(90);
      },
    });

    const cleanupQueue = this.queueService.getQueue(AUTOMATION_EXECUTION_CLEANUP_QUEUE);
    if (cleanupQueue) {
      const appTimezone = process.env.APP_TIMEZONE ?? 'UTC';
      const cronPattern = cronForLocalHour(3, appTimezone);
      try {
        await cleanupQueue.upsertJobScheduler(
          'automation-execution-cleanup',
          { pattern: cronPattern },
          { name: AUTOMATION_EXECUTION_CLEANUP_QUEUE, data: {} },
        );
        this.logger.log(`Execution log cleanup registered (${cronPattern}, 3:00 AM ${appTimezone})`);
      } catch (err) {
        this.logger.error('Failed to register execution cleanup', { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
}
