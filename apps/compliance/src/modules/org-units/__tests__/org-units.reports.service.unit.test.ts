import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgUnitsReportsService } from '../org-units.reports.service';

/**
 * Unit tests for the app-level OrgUnitsReportsService — composes the
 * compliance-filings per-team counts primitive with team names from
 * OrgUnitService into the user-facing TeamWorkloadRow shape. The
 * counts and name-resolution sources are mocked; only the join and
 * post-resolve filter logic are exercised here.
 */
describe('OrgUnitsReportsService', () => {
  let orgUnits: { findAll: ReturnType<typeof vi.fn> };
  let filingsReports: { getCountsByTeam: ReturnType<typeof vi.fn> };
  let service: OrgUnitsReportsService;

  beforeEach(() => {
    orgUnits = { findAll: vi.fn().mockResolvedValue([]) };
    filingsReports = { getCountsByTeam: vi.fn().mockResolvedValue([]) };
    service = new OrgUnitsReportsService(
      orgUnits as never,
      filingsReports as never,
    );
  });

  describe('getTeamWorkload', () => {
    it('joins counts × team names and computes onTimeRate as onTime / (onTime + late)', async () => {
      filingsReports.getCountsByTeam.mockResolvedValueOnce([
        {
          assigneeTeamId: 't1',
          totalAssigned: 10,
          completed: 7,
          inProgress: 1,
          overdue: 2,
          onTime: 6,
          late: 1,
        },
      ]);
      orgUnits.findAll.mockResolvedValueOnce([{ id: 't1', name: 'GST Team' }]);

      const result = await service.getTeamWorkload(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
      );

      expect(result).toEqual([
        {
          assigneeTeamId: 't1',
          assigneeTeamName: 'GST Team',
          totalAssigned: 10,
          completed: 7,
          inProgress: 1,
          overdue: 2,
          // 6 / (6 + 1) → 86%
          onTimeRate: 86,
        },
      ]);
    });

    it('falls back to empty team name when the org unit is missing', async () => {
      filingsReports.getCountsByTeam.mockResolvedValueOnce([
        {
          assigneeTeamId: 'orphan',
          totalAssigned: 1,
          completed: 0,
          inProgress: 1,
          overdue: 0,
          onTime: 0,
          late: 0,
        },
      ]);
      orgUnits.findAll.mockResolvedValueOnce([]);

      const result = await service.getTeamWorkload(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
      );

      expect(result[0].assigneeTeamName).toBe('');
      // No completions → onTimeRate is 0 (avoids divide-by-zero)
      expect(result[0].onTimeRate).toBe(0);
    });

    it('post-resolve search filter: drops teams whose name does not contain q (case-insensitive)', async () => {
      filingsReports.getCountsByTeam.mockResolvedValueOnce([
        { assigneeTeamId: 't1', totalAssigned: 1, completed: 0, inProgress: 0, overdue: 0, onTime: 0, late: 0 },
        { assigneeTeamId: 't2', totalAssigned: 1, completed: 0, inProgress: 0, overdue: 0, onTime: 0, late: 0 },
      ]);
      orgUnits.findAll.mockResolvedValueOnce([
        { id: 't1', name: 'GST Team' },
        { id: 't2', name: 'TDS Squad' },
      ]);

      const result = await service.getTeamWorkload(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
        { q: 'gst' },
      );

      expect(result.map((r) => r.assigneeTeamName)).toEqual(['GST Team']);
    });

    it('forwards accessCtx into the filings counts primitive', async () => {
      const accessCtx = { userId: 'u1', scopes: [{ type: 'unit' }] } as never;

      await service.getTeamWorkload(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
        undefined,
        accessCtx,
      );

      expect(filingsReports.getCountsByTeam).toHaveBeenCalledWith(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
        accessCtx,
      );
    });
  });
});
