import { Injectable } from '@nestjs/common';
import { OrgUnitService } from '@packages/org-units';
import type { DataAccessContext } from '@packages/rbac';
import {
  ComplianceFilingsReportsService,
  type ReportRange,
} from '@domains/compliance-api/compliance-filings';

/**
 * One row in the team-workload report — the result of joining
 * compliance-filings counts (per team) with team names from
 * org-units. Future cross-domain extensions (e.g. candidate counts,
 * project counts) get added as additional fields on this row.
 */
export interface TeamWorkloadRow {
  assigneeTeamId: string;
  assigneeTeamName: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  onTimeRate: number;
}

/**
 * App-level reports service for org-units-rooted aggregations that
 * span multiple domains. Lives in the app (not in a domain) because
 * the compose step needs both `OrgUnitService` (for team names) and
 * a domain primitive (compliance-filings counts) — and because the
 * app is the only layer where DI overrides like `ComplianceOrgUnitService`
 * resolve correctly.
 *
 * Pattern mirrors the data-fetching rule's "dedicated read-projection
 * endpoint at the composition layer." Domains expose primitives
 * (IDs + counts); the app composes the user-facing row shape.
 *
 * As recruit/projects/etc grow per-team primitives, additional fields
 * (candidates per team, projects per team) get added here, not in any
 * single domain's reports service.
 */
@Injectable()
export class OrgUnitsReportsService {
  constructor(
    private readonly orgUnits: OrgUnitService,
    private readonly filingsReports: ComplianceFilingsReportsService,
  ) {}

  /**
   * Per-team workload over a date range. Composes filings counts (from
   * compliance-filings) with team names (from org-units) into a single
   * display-ready row per team. Optional `q` filters by team name —
   * applied post-resolve since the team name lives in org-units, not
   * in compliance_filings. Acceptable here because the workload result
   * is bounded to one row per team (low-cardinality).
   *
   * On-time rate is `onTime / (onTime + late)` — treats "in progress"
   * as still earnable.
   */
  async getTeamWorkload(
    range: ReportRange,
    today: string,
    options?: { q?: string },
    accessCtx?: DataAccessContext,
  ): Promise<TeamWorkloadRow[]> {
    const counts = await this.filingsReports.getCountsByTeam(range, today, accessCtx);

    const allUnits = await this.orgUnits.findAll();
    const nameById = new Map(allUnits.map((u) => [u.id, u.name]));

    const q = options?.q?.trim().toLowerCase() ?? '';
    return counts.flatMap<TeamWorkloadRow>((row) => {
      const teamName = nameById.get(row.assigneeTeamId) ?? '';
      if (q.length > 0 && !teamName.toLowerCase().includes(q)) return [];
      const sum = row.onTime + row.late;
      return [{
        assigneeTeamId: row.assigneeTeamId,
        assigneeTeamName: teamName,
        totalAssigned: row.totalAssigned,
        completed: row.completed,
        inProgress: row.inProgress,
        overdue: row.overdue,
        onTimeRate: sum > 0 ? Math.round((row.onTime / sum) * 100) : 0,
      }];
    });
  }
}
