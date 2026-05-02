import { forwardRef, Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { ComplianceRulesModule } from '../rules';
import { LawsModule } from '../laws';
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
 *
 * No `EntityEngineModule.forEntity` and no lookup registration:
 * law-handlers is not a lookup target for any other entity (no `nameField`
 * — its only label-shaped fields are FKs into laws / org-units / clients,
 * which surface their own labels via service composition).
 */
@Module({
  imports: [
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
