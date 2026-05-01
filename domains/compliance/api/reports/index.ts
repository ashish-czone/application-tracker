/**
 * Public API for the compliance-reports module.
 *
 * Cross-module callers MUST import from `../reports` (this barrel).
 *
 * Reports has no schema/dto/seeds — it's a read-only aggregation layer
 * over compliance-filings + clients + related tables. The module exposes
 * just the service, the controller, and the public types describing
 * report row shapes.
 */

export { ComplianceReportsModule } from './reports.module';

export {
  ComplianceReportsService,
  type TrendBucket,
  type ClientBreakdownRow,
  type AgingBucket,
  type SeverityBreakdownRow,
  type TeamWorkloadRow,
  type ReportRange,
} from './reports.service';
