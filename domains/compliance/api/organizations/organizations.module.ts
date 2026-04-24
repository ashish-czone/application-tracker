import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { ORGANIZATIONS_CONFIG } from './organizations.config';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [EntityEngineModule.forEntity(ORGANIZATIONS_CONFIG, { controller: 'none' })],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
