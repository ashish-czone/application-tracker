import type { ScopeAnchorMap } from '@packages/rbac';
import { complianceLawHandlers } from './law-handlers.schema';

/**
 * Anchor columns for law-handlers.
 *
 * Wired into `BaseCrudService` via `createCrudProvider({ scope: ... })`
 * in `law-handlers.module.ts`. Forward-compat: no current role grant
 * uses a non-`'any'` scope on `law-handlers.read`, so the predicate path
 * is dormant today. Declared so a future scoped grant lights up without
 * a code change.
 *
 * Only `team` is available — `orgEntityId` references an `org_units`
 * row, mirroring how `compliance-filings.assigneeTeamId` becomes the
 * `team` anchor. The table has no `createdBy` column (handlers are
 * structural pivot rows, not user-authored records), so `creator` /
 * `assignee` anchors don't apply. If product later wants "handlers in
 * my org-unit subtree" the existing `descendants` scope kind already
 * walks the org-units tree from this anchor.
 */
export const LAW_HANDLERS_ANCHORS: ScopeAnchorMap = {
  team: complianceLawHandlers.orgEntityId,
};
