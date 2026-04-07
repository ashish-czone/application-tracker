import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '@packages/database';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { DomainEvent } from '@packages/events';
import { withTenantInsert } from '@packages/tenancy/helpers';
import { AuditRegistryService } from '../services/audit-registry.service';
import { auditLogs } from '../schema';
import { computeDiff, inferAction, redactSensitiveFields } from '../helpers/diff';

@Injectable()
export class AuditListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly registry: AuditRegistryService,
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(AuditListener.name);
  }

  @OnEvent('**')
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      const match = this.registry.findRegistration(event.eventName);
      if (!match) return;

      const { registration } = match;
      const payload = event.payload as Record<string, unknown>;
      const sensitiveFields = registration.sensitiveFields ?? [];

      const targetEntityType = (payload.targetEntityType as string) ?? null;
      const targetEntityId = (payload.targetEntityId as string) ?? null;

      const action = inferAction(event.eventName);

      const before = redactSensitiveFields(
        (payload.before as Record<string, unknown>) ?? null,
        sensitiveFields,
      );
      const after = redactSensitiveFields(
        (payload.after as Record<string, unknown>) ?? null,
        sensitiveFields,
      );

      let changes: Record<string, { from: unknown; to: unknown }> | null = null;
      if (action === 'updated' && before && after) {
        changes = computeDiff(before, after);
        if (!changes) {
          this.logger.debug('Skipping no-op audit entry', {
            eventName: event.eventName,
            entityId: event.entityId,
          });
          return;
        }
      }

      await this.database.db.insert(auditLogs).values(withTenantInsert(auditLogs, {
        entityType: event.entityType,
        entityId: event.entityId,
        action,
        eventName: event.eventName,
        actorId: event.actorId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changes: changes as Record<string, unknown>,
        correlationId: event.correlationId,
        targetEntityType,
        targetEntityId,
        occurredAt: new Date(event.occurredAt),
      }));

      this.logger.debug('Audit log written', {
        eventName: event.eventName,
        entityType: event.entityType,
        entityId: event.entityId,
        action,
      });
    } catch (error) {
      this.logger.error('Audit listener error', {
        eventName: event.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
