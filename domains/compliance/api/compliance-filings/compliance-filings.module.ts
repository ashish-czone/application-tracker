import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { COMPLIANCE_FILINGS_CONFIG } from './compliance-filings.config';
import { COMPLIANCE_FILINGS_WORKFLOW } from './compliance-filings.workflow';
import { COMPLIANCE_FILINGS_PERMISSION_MANIFESTS } from './compliance-filings.permissions';
import { COMPLIANCE_FILINGS_CRUD_TOKEN } from './compliance-filings.crud-token';
import { complianceFilings } from './compliance-filings.schema';
import { ComplianceFilingsController } from './compliance-filings.controller';
import { ComplianceFilingsReportsController } from './compliance-filings.reports.controller';
import { ComplianceFilingsService } from './compliance-filings.service';
import { ComplianceFilingsReportsService } from './compliance-filings.reports.service';
import { ComplianceFilingsLookupService } from './compliance-filings.lookup.service';
import { ComplianceFilingsCancellationService } from './compliance-filings.cancellation.service';
import { ComplianceFilingsAssigneeCleanupService } from './compliance-filings.assignee-cleanup.service';
import { LawsModule } from '../laws';

const filingsEntityEngineModule = EntityEngineModule.forEntity(COMPLIANCE_FILINGS_CONFIG);

/**
 * Compliance filings module.
 *
 * Five services co-exist here because they serve genuinely distinct
 * concerns:
 *  - ComplianceFilingsService — CRUD + create-time externalKey derivation
 *    and completedAt stamping (moved out of beforeCreate/beforeUpdate
 *    hooks so all create-time logic lives in one place)
 *  - ComplianceFilingsReportsService — single-domain aggregations over
 *    `compliance_filings` (trend, by-client, aging, severity) plus the
 *    `getCountsByTeam` primitive consumed by the app-level org-units
 *    reports composition
 *  - ComplianceFilingsLookupService — read-only lookups used by the
 *    generate-compliance-filings automation to dedupe before insert
 *  - ComplianceFilingsCancellationService — batch-cancellation called
 *    from the dormancy cascade and from registration deactivation
 *  - ComplianceFilingsAssigneeCleanupService — clears assigneeId on
 *    non-terminal filings when the assigned user is deactivated
 *    (US-7.4 / US-12.2 / US-12.3)
 *
 * Reports + lookup + cancellation + assignee-cleanup are exported so
 * consumers (rules, dormancy, AppUsersService, app-level org-units
 * reports) can inject them.
 */
@Module({
  imports: [
    filingsEntityEngineModule,
    WorkflowsModule.forFeature(COMPLIANCE_FILINGS_WORKFLOW),
    RbacIntegrationModule.forFeature({ manifests: COMPLIANCE_FILINGS_PERMISSION_MANIFESTS }),
    LawsModule,
  ],
  controllers: [ComplianceFilingsController, ComplianceFilingsReportsController],
  providers: [
    createCrudProvider(COMPLIANCE_FILINGS_CRUD_TOKEN, complianceFilings, {
      slug: 'compliance-filings',
      events: {
        created: 'compliance-filings.Created',
        updated: 'compliance-filings.Updated',
        deleted: 'compliance-filings.Deleted',
      },
    }),
    ComplianceFilingsService,
    ComplianceFilingsReportsService,
    ComplianceFilingsLookupService,
    ComplianceFilingsCancellationService,
    ComplianceFilingsAssigneeCleanupService,
  ],
  exports: [
    filingsEntityEngineModule,
    ComplianceFilingsService,
    ComplianceFilingsReportsService,
    ComplianceFilingsLookupService,
    ComplianceFilingsCancellationService,
    ComplianceFilingsAssigneeCleanupService,
  ],
})
export class ComplianceFilingsModule {}
