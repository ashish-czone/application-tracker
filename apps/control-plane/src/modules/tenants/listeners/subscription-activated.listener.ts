import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { TenantRegistryService } from '@packages/tenancy';
import { SUBSCRIPTIONS_ACTIVATED } from '@packages/orders-subscriptions';
import type { DomainEvent } from '@packages/events';
import { DatabaseService, eq } from '@packages/database';
import { clients } from '../../clients/schema/clients';
import { randomUUID } from 'crypto';

@Injectable()
export class SubscriptionActivatedListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(SubscriptionActivatedListener.name);
  }

  @OnEvent(SUBSCRIPTIONS_ACTIVATED)
  async handleSubscriptionActivated(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      clientId: string;
      planId: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      after: Record<string, unknown>;
    };

    try {
      const client = await this.findClient(payload.clientId);
      if (!client) {
        this.logger.error('Client not found for subscription activation', {
          clientId: payload.clientId,
          subscriptionId: event.entityId,
        });
        return;
      }

      const slug = this.generateSlug(client.name);
      const databaseUrl = this.generateDatabaseUrl(slug);

      const planSnapshot = (payload.after as Record<string, unknown>).planSnapshot as Record<string, unknown> | undefined;
      const capabilities = planSnapshot?.capabilities as Record<string, boolean | string | number> | undefined;
      const capabilityKeys = capabilities
        ? Object.entries(capabilities).filter(([, v]) => !!v).map(([k]) => k)
        : undefined;

      const tenant = await this.tenantRegistry.create({
        slug,
        name: client.name,
        databaseUrl,
        status: 'provisioning',
        plan: (planSnapshot?.slug as string) ?? undefined,
        capabilities: capabilityKeys,
        planExpiry: payload.currentPeriodEnd,
        clientId: payload.clientId,
      });

      this.logger.log('Tenant record created from subscription activation', {
        tenantId: tenant.id,
        slug: tenant.slug,
        clientId: payload.clientId,
        subscriptionId: event.entityId,
        status: 'provisioning',
      });
    } catch (error) {
      this.logger.error('Failed to create tenant from subscription activation', {
        subscriptionId: event.entityId,
        clientId: payload.clientId,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error.stack : undefined);
    }
  }

  private async findClient(clientId: string): Promise<{ id: string; name: string } | null> {
    const [client] = await this.database.db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    return client ?? null;
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);

    const suffix = randomUUID().slice(0, 6);
    return `${base}-${suffix}`;
  }

  private generateDatabaseUrl(slug: string): string {
    const template = this.config.get<string>('TENANT_DB_URL_TEMPLATE');
    if (!template) {
      throw new Error('TENANT_DB_URL_TEMPLATE env var is required for automated tenant provisioning');
    }
    const dbName = `tenant_${slug.replace(/-/g, '_')}`;
    return template.replace('{slug}', slug).replace('{db_name}', dbName);
  }
}
