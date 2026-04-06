import { Module } from '@nestjs/common';
import { TenantRegistryService } from '@packages/tenancy';
import { InternalTenantsController } from './controllers/internal-tenants.controller';
import { TenantsController } from './controllers/tenants.controller';
import { SubscriptionActivatedListener } from './listeners/subscription-activated.listener';

@Module({
  controllers: [InternalTenantsController, TenantsController],
  providers: [TenantRegistryService, SubscriptionActivatedListener],
  exports: [TenantRegistryService],
})
export class TenantsModule {}
