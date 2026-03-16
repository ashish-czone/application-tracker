import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { userRoles } from '@packages/rbac';
import type { DomainEvent } from '@packages/events';
import type { NotificationRule } from '../types';

@Injectable()
export class RecipientResolver {
  private readonly logger = new Logger(RecipientResolver.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Resolve recipient user IDs based on the rule's strategy and the event context.
   */
  async resolve(rule: NotificationRule, event: DomainEvent): Promise<string[]> {
    switch (rule.recipientStrategy) {
      case 'actor':
        return this.resolveActor(event);
      case 'entity_owner':
        return this.resolveEntityOwner(event);
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

  private resolveEntityOwner(event: DomainEvent): string[] {
    // Entity owner is expected in the payload as 'ownerId'
    const ownerId = event.payload?.ownerId as string | undefined;
    if (!ownerId) {
      this.logger.warn(`entity_owner strategy but no ownerId in payload for event ${event.eventName}`);
      return [];
    }
    return [ownerId];
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
