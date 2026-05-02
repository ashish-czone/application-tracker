import { Module, type OnModuleInit } from '@nestjs/common';
import {
  LookupResolverService,
  registerEntityLookup,
} from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { COMPLIANCE_FILINGS_WORKFLOW } from './compliance-filings.workflow';
import { COMPLIANCE_FILINGS_PERMISSION_MANIFESTS } from './compliance-filings.permissions';
import { COMPLIANCE_FILINGS_CRUD_TOKEN } from './compliance-filings.crud-token';
import {
  COMPLIANCE_FILINGS_ANCHORS,
  COMPLIANCE_FILINGS_INLINE_SCOPES,
} from './compliance-filings.scope';
import { complianceFilings } from './compliance-filings.schema';
import { ComplianceFilingsController } from './compliance-filings.controller';
import { ComplianceFilingsReportsController } from './compliance-filings.reports.controller';
import { ComplianceFilingsService } from './compliance-filings.service';
import { ComplianceFilingsReportsService } from './compliance-filings.reports.service';
import { ComplianceFilingsLookupService } from './compliance-filings.lookup.service';
import { ComplianceFilingsCancellationService } from './compliance-filings.cancellation.service';
import { ComplianceFilingsAssigneeCleanupService } from './compliance-filings.assignee-cleanup.service';
import { LawsModule } from '../laws';

/**
 * Compliance filings module — fully de-engined. Five services co-exist
 * here because they serve genuinely distinct concerns:
 *
 *  - ComplianceFilingsService — CRUD + create-time externalKey derivation
 *    and completedAt stamping; workflow transitions (handled directly
 *    via WorkflowEngineService post-lift, no engine indirection).
 *  - ComplianceFilingsReportsService — single-domain aggregations over
 *    `compliance_filings` (trend, by-client, aging, severity) plus the
 *    `getCountsByTeam` primitive consumed by the app-level org-units
 *    reports composition. Scope predicates built directly via
 *    DataAccessScopeService + the canonical anchors/inline-scopes from
 *    `compliance-filings.scope.ts`.
 *  - ComplianceFilingsLookupService — read-only lookups used by the
 *    generate-compliance-filings automation to dedupe before insert.
 *  - ComplianceFilingsCancellationService — batch-cancellation called
 *    from the dormancy cascade and from registration deactivation.
 *  - ComplianceFilingsAssigneeCleanupService — clears assigneeId on
 *    non-terminal filings when the assigned user is deactivated.
 *
 * Lookup registration (so other entities can resolve `?include=filingTitle`)
 * happens via `registerEntityLookup` in `onModuleInit` — no `defineEntity`
 * config and no `EntityEngineModule.forEntity` call.
 */
@Module({
  imports: [
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
      scope: {
        anchors: COMPLIANCE_FILINGS_ANCHORS,
        inlineResolvers: COMPLIANCE_FILINGS_INLINE_SCOPES,
      },
    }),
    ComplianceFilingsService,
    ComplianceFilingsReportsService,
    ComplianceFilingsLookupService,
    ComplianceFilingsCancellationService,
    ComplianceFilingsAssigneeCleanupService,
  ],
  exports: [
    ComplianceFilingsService,
    ComplianceFilingsReportsService,
    ComplianceFilingsLookupService,
    ComplianceFilingsCancellationService,
    ComplianceFilingsAssigneeCleanupService,
  ],
})
export class ComplianceFilingsModule implements OnModuleInit {
  constructor(private readonly lookupResolver: LookupResolverService) {}

  onModuleInit(): void {
    registerEntityLookup(this.lookupResolver, {
      entityType: 'compliance-filings',
      table: complianceFilings,
      labelField: 'title',
      searchFields: ['title', 'description'],
    });
  }
}
