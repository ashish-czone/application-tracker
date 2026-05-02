import { and, isNull, sql } from '@packages/database';
import { orgUnitMembers } from '@packages/org-units';
import {
  type DataAccessContext,
  type DataAccessScopeService,
  type InlineScopeResolver,
  type ScopeAnchorMap,
} from '@packages/rbac';
import { complianceFilings } from './compliance-filings.schema';

/**
 * Anchor columns for compliance-filings — the `(role → column)` map the
 * `DataAccessScopeService` consults when resolving generic scope kinds
 * (`own` / `assigned` / `unit` / `descendants`). Pre-lift this lived on
 * the `defineEntity({ dataAccess.anchors })` block; the engine read it
 * via `EntityService.buildAnchors()`. Post-lift it's an explicit const
 * the consumer service injects into every `buildPredicate` call.
 */
export const COMPLIANCE_FILINGS_ANCHORS: ScopeAnchorMap = {
  creator: complianceFilings.createdBy,
  assignee: complianceFilings.assigneeId,
  team: complianceFilings.assigneeTeamId,
};

/**
 * Inline scope resolver for the `unassigned_in_unit` pickup pool —
 * filings unclaimed (assigneeId IS NULL) in a team the actor belongs to.
 * Used by Preparers / Reviewers whose `pickup` grant is scoped to this
 * key so they can only self-claim from their team pool — never from
 * another team and never steal work already assigned to someone else
 * (even if it's still pending).
 *
 * Pre-lift this lived in `defineEntity({ dataAccess.scopes })`; the
 * engine consulted it during `buildPredicate`. Post-lift it's passed
 * directly as `inlineResolvers` to `DataAccessScopeService.buildPredicate`.
 */
export const COMPLIANCE_FILINGS_INLINE_SCOPES: ReadonlyArray<InlineScopeResolver> = [
  {
    key: 'unassigned_in_unit',
    resolve: (userId: string) => and(
      isNull(complianceFilings.assigneeId),
      sql`${complianceFilings.assigneeTeamId} IN (SELECT ${orgUnitMembers.orgUnitId} FROM ${orgUnitMembers} WHERE ${orgUnitMembers.userId} = ${userId})`,
    )!,
  },
];

/**
 * Convenience wrapper that delegates to `DataAccessScopeService.buildPredicate`
 * with the canonical anchors + inline scopes. Returns `undefined` when no
 * `accessCtx` is supplied — preserves the pre-lift behaviour where
 * `entityService.getScopePredicate(undefined)` was a no-op.
 */
export async function buildFilingsScopePredicate(
  dataAccessScope: DataAccessScopeService,
  accessCtx: DataAccessContext | undefined,
) {
  if (!accessCtx) return undefined;
  return dataAccessScope.buildPredicate(accessCtx, {
    anchors: COMPLIANCE_FILINGS_ANCHORS,
    inlineResolvers: COMPLIANCE_FILINGS_INLINE_SCOPES,
  });
}
