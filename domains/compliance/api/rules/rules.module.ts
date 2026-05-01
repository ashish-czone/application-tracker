import { forwardRef, Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { LawHandlersModule } from '../law-handlers/law-handlers.module';
import { ComplianceFilingsModule } from '../compliance-filings/compliance-filings.module';
import { RULES_WORKFLOW } from './rules.workflow';
import { ComplianceRulesController } from './rules.controller';
import { ComplianceRulesService } from './rules.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(RULES_WORKFLOW),
    forwardRef(() => LawHandlersModule),
    ComplianceFilingsModule,
  ],
  controllers: [ComplianceRulesController],
  providers: [ComplianceRulesService],
  exports: [ComplianceRulesService],
})
export class ComplianceRulesModule {}
