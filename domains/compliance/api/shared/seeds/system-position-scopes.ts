import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { OrgPositionService, orgPositionScopes } from '@packages/org-units';

/**
 * System seed for (position × task-entity) scope rows.
 *
 * Per Q14 (see domains/compliance/todos.md §1), V1 seeds scopes only for
 * task entities — other compliance entities (clients, registrations, rules,
 * laws, etc.) stay on the platform's fail-closed default of `own` and get
 * their scope model decided when their list UIs are wired.
 *
 * Ten rows total (5 positions × 2 task-entity slugs):
 *
 *   position       | tasks       | compliance-tasks
 *   ---------------|-------------|------------------
 *   Member         | unit        | unit
 *   Lead           | unit        | unit
 *   Head           | unit        | unit
 *   Division Head  | descendants | descendants
 *   Firm Admin     | all         | all
 *
 * `entityType` values are the exact entity slugs the engine keys scope
 * resolution on (see packages/platform/entity-engine/api/define-entity.ts:345
 * — `entityType = model.slug`). The compliance-tasks extension's slug is
 * hyphenated (`compliance-tasks`), not underscored.
 *
 * Idempotent via composite-PK upsert — preserves admin-edited scope values
 * because we only insert missing (positionId, entityType) pairs.
 */

const SCOPE_BY_POSITION: Record<string, 'unit' | 'descendants' | 'all'> = {
  'Member':        'unit',
  'Lead':          'unit',
  'Head':          'unit',
  'Division Head': 'descendants',
  'Firm Admin':    'all',
};

const TASK_ENTITY_TYPES = ['tasks', 'compliance-tasks'] as const;

export const seedSystemPositionScopes = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const positionService = ctx.get(OrgPositionService);

  const positions = await positionService.findAll();
  const positionByName = new Map(positions.map((p) => [p.name, p] as const));

  const rows: { positionId: string; entityType: string; scope: string }[] = [];
  for (const [positionName, scope] of Object.entries(SCOPE_BY_POSITION)) {
    const position = positionByName.get(positionName);
    if (!position) continue;
    for (const entityType of TASK_ENTITY_TYPES) {
      rows.push({ positionId: position.id, entityType, scope });
    }
  }

  if (rows.length === 0) return;

  await database.db.insert(orgPositionScopes).values(rows).onConflictDoNothing();
};
