import { forwardRef, Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { LawHandlersModule } from '../law-handlers';
import { ComplianceFilingsModule } from '../compliance-filings';
import { RULES_ENTITY } from './rules.entity';
import { RULES_WORKFLOW } from './rules.workflow';
import { ComplianceRulesController } from './rules.controller';
import { ComplianceRulesService } from './rules.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(RULES_ENTITY),
    WorkflowsModule.forFeature(RULES_WORKFLOW),
    forwardRef(() => LawHandlersModule),
    ComplianceFilingsModule,
  ],
  controllers: [ComplianceRulesController],
  providers: [ComplianceRulesService],
  exports: [ComplianceRulesService],
})
export class ComplianceRulesModule {}
