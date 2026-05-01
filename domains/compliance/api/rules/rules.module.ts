import { forwardRef, Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { RbacIntegrationModule } from '@packages/rbac';
import { LawHandlersModule } from '../law-handlers';
import { ComplianceFilingsModule } from '../compliance-filings';
import { RULES_ENTITY } from './rules.entity';
import { RULES_WORKFLOW } from './rules.workflow';
import { RULES_PERMISSION_MANIFESTS } from './rules.permissions';
import { ComplianceRulesController } from './rules.controller';
import { ComplianceRulesService } from './rules.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(RULES_ENTITY),
    WorkflowsModule.forFeature(RULES_WORKFLOW),
    RbacIntegrationModule.forFeature({ manifests: RULES_PERMISSION_MANIFESTS }),
    forwardRef(() => LawHandlersModule),
    ComplianceFilingsModule,
  ],
  controllers: [ComplianceRulesController],
  providers: [ComplianceRulesService],
  exports: [ComplianceRulesService],
})
export class ComplianceRulesModule {}
