import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { LawHandlersModule } from '../law-handlers/law-handlers.module';
import { ComplianceFilingsModule } from '../compliance-filings/compliance-filings.module';
import { COMPLIANCE_RULES_CONFIG } from './rules.config';
import { ComplianceRulesController } from './compliance-rules.controller';
import { ComplianceRulesService } from './compliance-rules.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(COMPLIANCE_RULES_CONFIG),
    LawHandlersModule,
    ComplianceFilingsModule,
  ],
  controllers: [ComplianceRulesController],
  providers: [ComplianceRulesService],
  exports: [ComplianceRulesService],
})
export class ComplianceRulesModule {}
