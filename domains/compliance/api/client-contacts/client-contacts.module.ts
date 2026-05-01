import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { CLIENT_CONTACTS_CONFIG } from './client-contacts.config';
import { CLIENT_CONTACTS_PERMISSION_MANIFESTS } from './client-contacts.permissions';
import { ClientContactsController } from './client-contacts.controller';
import { ClientContactsService } from './client-contacts.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(CLIENT_CONTACTS_CONFIG),
    RbacIntegrationModule.forFeature({ manifests: CLIENT_CONTACTS_PERMISSION_MANIFESTS }),
  ],
  controllers: [ClientContactsController],
  providers: [ClientContactsService],
  exports: [ClientContactsService],
})
export class ClientContactsModule {}
