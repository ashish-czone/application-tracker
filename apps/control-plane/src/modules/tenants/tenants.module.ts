import { Module } from '@nestjs/common';
import { TenantRegistryService } from '@packages/tenancy';
import { InternalTenantsController } from './controllers/internal-tenants.controller';
import { TenantsController } from './controllers/tenants.controller';

@Module({
  controllers: [InternalTenantsController, TenantsController],
  providers: [TenantRegistryService],
  exports: [TenantRegistryService],
})
export class TenantsModule {}
