import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { VENDORS_CONFIG } from './vendors.config';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

/**
 * Vendors domain module.
 *
 * Registers the entity with the engine for metadata, layout, RBAC manifests,
 * seeding, and service-token provisioning — but opts out of the auto-mounted
 * generic CRUD controller. HTTP routing is owned by `VendorsController`.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(VENDORS_CONFIG, { controller: 'none' }),
  ],
  controllers: [VendorsController],
  providers: [VendorsService],
})
export class VendorsModule {}
