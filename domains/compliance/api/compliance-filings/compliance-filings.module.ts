import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { COMPLIANCE_FILINGS_CONFIG } from './compliance-filings.config';
import { COMPLIANCE_FILINGS_WORKFLOW } from './compliance-filings.workflow';
import { ComplianceFilingsController } from './compliance-filings.controller';
import { ComplianceFilingsService } from './compliance-filings.service';
import { ComplianceFilingsLookupService } from './compliance-filings.lookup.service';
import { ComplianceFilingsCancellationService } from './compliance-filings.cancellation.service';
import { ComplianceFilingsAssigneeCleanupService } from './compliance-filings.assignee-cleanup.service';
import { LawsModule } from '../laws';

const filingsEntityEngineModule = EntityEngineModule.forEntity(COMPLIANCE_FILINGS_CONFIG);

/**
 * Compliance filings module.
 *
 * Four services co-exist here because they serve genuinely distinct
 * concerns:
 *  - ComplianceFilingsService — CRUD + create-time externalKey derivation
 *    and completedAt stamping (moved out of beforeCreate/beforeUpdate
 *    hooks so all create-time logic lives in one place)
 *  - ComplianceFilingsLookupService — read-only lookups used by the
 *    generate-compliance-filings automation to dedupe before insert
 *  - ComplianceFilingsCancellationService — batch-cancellation called
 *    from the dormancy cascade and from registration deactivation
 *  - ComplianceFilingsAssigneeCleanupService — clears assigneeId on
 *    non-terminal filings when the assigned user is deactivated
 *    (US-7.4 / US-12.2 / US-12.3)
 *
 * Lookup + cancellation + assignee-cleanup are exported so consumers
 * (rules, dormancy, AppUsersService) can inject them.
 */
@Module({
  imports: [
    filingsEntityEngineModule,
    WorkflowsModule.forFeature(COMPLIANCE_FILINGS_WORKFLOW),
    LawsModule,
  ],
  controllers: [ComplianceFilingsController],
  providers: [
    ComplianceFilingsService,
    ComplianceFilingsLookupService,
    ComplianceFilingsCancellationService,
    ComplianceFilingsAssigneeCleanupService,
  ],
  exports: [
    filingsEntityEngineModule,
    ComplianceFilingsService,
    ComplianceFilingsLookupService,
    ComplianceFilingsCancellationService,
    ComplianceFilingsAssigneeCleanupService,
  ],
})
export class ComplianceFilingsModule {}
