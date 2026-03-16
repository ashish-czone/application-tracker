import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { userRoles } from '@packages/rbac';
import type { DomainEvent } from '@packages/events';
import type { NotificationRule } from '../types';
import { EntityResolverRegistry } from './entity-resolver-registry';

@Injectable()
export class RecipientResolver {
  private readonly logger = new Logger(RecipientResolver.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly entityResolverRegistry: EntityResolverRegistry,
  ) {}

  /**
   * Resolve recipient user IDs based on the rule's strategy and the event context.
   */
  async resolve(rule: NotificationRule, event: DomainEvent): Promise<string[]> {
    switch (rule.recipientStrategy) {
      case 'actor':
        return this.resolveActor(event);
      case 'entity_owner':
        return this.resolveEntityOwner(rule, event);
      case 'role':
        return this.resolveByRole(rule);
      default:
        this.logger.warn(`Unknown recipient strategy: ${rule.recipientStrategy}`);
        return [];
    }
  }

  private resolveActor(event: DomainEvent): string[] {
    if (!event.actorId) return [];
    return [event.actorId];
  }

  /**
   * Resolve entity owner from the configured recipient field.
   * For event-triggered rules: reads from event payload.
   * For schedule-triggered rules: queries the entity from DB.
   */
  private async resolveEntityOwner(rule: NotificationRule, event: DomainEvent): Promise<string[]> {
    const field = (rule.recipientConfig as Record<string, unknown>)?.field as string | undefined;
    if (!field) {
      this.logger.warn(`entity_owner strategy but no 'field' in recipientConfig for rule ${rule.id}`);
      return [];
    }

    // For event-triggered: try payload first
    const fromPayload = event.payload?.[field] as string | undefined;
    if (fromPayload) return [fromPayload];

    // For schedule-triggered: query the entity from DB
    const entityType = rule.scheduleEntityType ?? event.entityType;
    const resolver = this.entityResolverRegistry.get(entityType);
    if (!resolver) {
      this.logger.warn(`No entity resolver for "${entityType}" — cannot resolve entity_owner`);
      return [];
    }

    const idColumn = (resolver.table as Record<string, any>).id;
    const ownerColumn = (resolver.table as Record<string, any>)[field];
    if (!ownerColumn) {
      this.logger.warn(`Field "${field}" not found on entity "${entityType}"`);
      return [];
    }

    const [entity] = await this.database.db
      .select({ ownerId: ownerColumn })
      .from(resolver.table)
      .where(eq(idColumn, event.entityId))
      .limit(1);

    if (!entity?.ownerId) return [];
    return [entity.ownerId as string];
  }

  private async resolveByRole(rule: NotificationRule): Promise<string[]> {
    const roleId = (rule.recipientConfig as Record<string, unknown>)?.roleId as string | undefined;
    if (!roleId) {
      this.logger.warn(`role strategy but no roleId in recipientConfig for rule ${rule.id}`);
      return [];
    }

    const rows = await this.database.db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));

    return rows.map((r) => r.userId);
  }
}
