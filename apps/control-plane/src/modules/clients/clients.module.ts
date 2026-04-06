import { Module, Injectable, type OnModuleInit } from '@nestjs/common';
import { DatabaseService, eq, isNull } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import {
  BillingClientResolverRegistry,
  type BillingClient,
  type BillingClientResolver,
} from '@packages/orders-billing';
import { clients } from './schema/clients';

@Injectable()
export class ClientResolver implements BillingClientResolver {
  constructor(private readonly database: DatabaseService) {}

  async resolve(clientId: string): Promise<BillingClient | null> {
    const [client] = await this.database.db
      .select()
      .from(clients)
      .where(
        withTenant(
          clients,
          eq(clients.id, clientId),
          isNull(clients.deletedAt),
        ),
      )
      .limit(1);

    if (!client) return null;

    return {
      id: client.id,
      name: client.name,
      email: client.email ?? undefined,
      metadata: client.metadata as Record<string, unknown> | undefined,
    };
  }
}

@Module({
  providers: [ClientResolver],
  exports: [ClientResolver],
})
export class ClientsModule implements OnModuleInit {
  constructor(
    private readonly billingClientRegistry: BillingClientResolverRegistry,
    private readonly clientResolver: ClientResolver,
  ) {}

  onModuleInit() {
    this.billingClientRegistry.register(this.clientResolver);
  }
}
