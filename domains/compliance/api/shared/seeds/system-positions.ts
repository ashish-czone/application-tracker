import type { INestApplicationContext } from '@nestjs/common';
import { OrgPositionService } from '@packages/org-units';

/**
 * System seed for compliance-domain default positions.
 *
 * Per Q14 (see domains/compliance/todos.md §1), the compliance platform ships
 * five canonical positions. Three of them (Head, Lead, Member) are already
 * seeded by the org-units package's own `seedDefaults()`; this seed is a
 * defensive superset that:
 *
 *  - Adds the two compliance-opinionated positions: Division Head (sortOrder 0,
 *    intended for division-level org units) and Firm Admin (sortOrder -1,
 *    firm-wide super-user).
 *  - Falls back to creating Head/Lead/Member if the package seed hasn't run
 *    (e.g. an app that mounts compliance but hasn't wired the org-units
 *    system seed, or a partial migration).
 *
 * Iterates by position name — the internal identifier is the row id, but the
 * name is the stable key for seed reconciliation (admins can rename display
 * names at runtime; we only seed when a row with that name is absent).
 *
 * Re-running is a no-op once all five are present.
 */

interface PositionSpec {
  name: string;
  sortOrder: number;
}

export const COMPLIANCE_POSITIONS: PositionSpec[] = [
  { name: 'Firm Admin',    sortOrder: -1 },
  { name: 'Head',          sortOrder: 0  },
  { name: 'Division Head', sortOrder: 0  },
  { name: 'Lead',          sortOrder: 1  },
  { name: 'Member',        sortOrder: 2  },
];

export const seedSystemPositions = async (ctx: INestApplicationContext): Promise<void> => {
  const positionService = ctx.get(OrgPositionService);

  const existing = await positionService.findAll();
  const byName = new Map(existing.map((p) => [p.name, p] as const));

  for (const spec of COMPLIANCE_POSITIONS) {
    if (byName.has(spec.name)) continue;
    await positionService.create({ name: spec.name, sortOrder: spec.sortOrder });
  }
};
