import { forwardRef, Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { ComplianceRulesModule } from '../rules/compliance-rules.module';
import { LawsModule } from '../laws/laws.module';
import { LAW_HANDLERS_CONFIG } from './law-handlers.config';
import { LawHandlersController } from './law-handlers.controller';
import { LawHandlersService } from './law-handlers.service';

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
    forwardRef(() => ComplianceRulesModule),
    LawsModule,
  ],
  controllers: [LawHandlersController],
  providers: [LawHandlersService],
  exports: [LawHandlersService],
})
export class LawHandlersModule {}
