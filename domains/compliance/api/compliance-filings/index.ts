/**
 * Public API for the compliance-filings module.
 *
 * Cross-module callers MUST import from `../compliance-filings` (this barrel),
 * not from individual files inside the folder. The barrel is the contract;
 * everything else is internal and free to be reorganised without breaking
 * callers.
 *
 * Internals NOT exported (intentionally):
 * - `COMPLIANCE_FILINGS_CONFIG` — entity-engine workflow definition,
 *                                   wired only by compliance-filings.module
 * - `compliance-filings.dto.*`  — request DTOs and the URL query schema,
 *                                   internal to the controller
 * - `compliance-filings.filters.*` — domain query translation, internal
 *                                       to the controller
 * - schema barrel — cross-module joins import the Drizzle table directly
 *                   from `./compliance-filings.schema`
 */

export { ComplianceFilingsModule } from './compliance-filings.module';

export {
  ComplianceFilingsService,
  type FilingsSummary,
} from './compliance-filings.service';

export {
  ComplianceFilingsReportsService,
  type TrendBucket,
  type ClientBreakdownRow,
  type AgingBucket,
  type SeverityBreakdownRow,
  type TeamFilingCounts,
  type ReportRange,
} from './compliance-filings.reports.service';

export { ComplianceFilingsLookupService } from './compliance-filings.lookup.service';

export { ComplianceFilingsCancellationService } from './compliance-filings.cancellation.service';

export { ComplianceFilingsAssigneeCleanupService } from './compliance-filings.assignee-cleanup.service';

export { buildFilingExternalKey } from './compliance-filings.config';
