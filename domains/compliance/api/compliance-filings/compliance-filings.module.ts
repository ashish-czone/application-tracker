import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { COMPLIANCE_FILINGS_CONFIG } from './compliance-filings.config';
import { ComplianceFilingsController } from './compliance-filings.controller';
import { ComplianceFilingsService } from './compliance-filings.service';
import { ComplianceFilingsLookupService } from './compliance-filings-lookup.service';
import { ComplianceFilingsCancellationService } from './compliance-filings-cancellation.service';

/**
 * Compliance filings module.
 *
 * Three services co-exist here because they serve genuinely distinct
 * concerns:
 *  - ComplianceFilingsService — CRUD + create-time externalKey derivation
 *    and completedAt stamping (moved out of beforeCreate/beforeUpdate
 *    hooks so all create-time logic lives in one place)
 *  - ComplianceFilingsLookupService — read-only lookups used by the
 *    generate-compliance-filings automation to dedupe before insert
 *  - ComplianceFilingsCancellationService — batch-cancellation called
 *    from the dormancy cascade and from registration deactivation
 *
 * Lookup + cancellation are exported so compliance.module.ts can inject
 * them into cross-entity services (rules, dormancy).
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(COMPLIANCE_FILINGS_CONFIG),
  ],
  controllers: [ComplianceFilingsController],
  providers: [
    ComplianceFilingsService,
    ComplianceFilingsLookupService,
    ComplianceFilingsCancellationService,
  ],
  exports: [
    ComplianceFilingsService,
    ComplianceFilingsLookupService,
    ComplianceFilingsCancellationService,
  ],
})
export class ComplianceFilingsModule {}
