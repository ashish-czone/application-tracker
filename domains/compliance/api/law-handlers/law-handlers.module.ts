import { forwardRef, Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { ComplianceRulesModule } from '../rules';
import { LawsModule } from '../laws';
import { LAW_HANDLERS_CONFIG } from './law-handlers.config';
import { LAW_HANDLERS_PERMISSION_MANIFESTS } from './law-handlers.permissions';
import { LawHandlersController } from './law-handlers.controller';
import { LawHandlersService } from './law-handlers.service';
import { LAW_HANDLERS_CRUD_TOKEN } from './law-handlers.crud-token';
import { complianceLawHandlers } from './law-handlers.schema';

/**
 * `forwardRef` on ComplianceRulesModule resolves the structural cycle:
 * ComplianceRulesService injects LawHandlersService (for hasDefaultHandler
 * during rule create), and LawHandlersController injects ComplianceRulesService
 * (for the I21 delete guard's assertHandlerCanBeDeleted). Nest builds the
 * graph in two passes — `forwardRef` is the standard tool for this exact
 * shape.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(LAW_HANDLERS_CONFIG),
    RbacIntegrationModule.forFeature({ manifests: LAW_HANDLERS_PERMISSION_MANIFESTS }),
    forwardRef(() => ComplianceRulesModule),
    LawsModule,
  ],
  controllers: [LawHandlersController],
  providers: [
    createCrudProvider(LAW_HANDLERS_CRUD_TOKEN, complianceLawHandlers, {
      slug: 'law-handlers',
      events: {
        created: 'law-handlers.Created',
        updated: 'law-handlers.Updated',
        deleted: 'law-handlers.Deleted',
      },
    }),
    LawHandlersService,
  ],
  exports: [LawHandlersService],
})
export class LawHandlersModule {}
