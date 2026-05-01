import { defineWorkflow } from '@packages/workflows';

/**
 * Workflow for compliance-rules.status. Lifted out of `defineEntity` per
 * the camp-B decoupling migration (#1242 / #1243 series). Registered via
 * `WorkflowsModule.forFeature(RULES_WORKFLOW)` in `rules.module.ts`.
 *
 * Slug + state names are code-load-bearing:
 *   - `ComplianceRuleStatus` is a TS literal union derived from these names
 *   - `ComplianceRulesService.deprecate` branches on `'deprecated'` (cascade)
 *     and the `'active'` default when reactivating
 *   - The workflow runtime resolves this def via (entityType, fieldName) =
 *     ('compliance-rules', 'status')
 *
 * Lock the identifiers in the admin UI — renaming via the workflows admin
 * surface would silently break the cascade branches in the service.
 */
export const RULES_WORKFLOW = defineWorkflow({
  slug: 'compliance-rule-status',
  entityType: 'compliance-rules',
  fieldName: 'status',
  initialState: 'draft',
  states: [
    { name: 'draft', label: 'Draft', color: '#6B7280', isSystem: true },
    { name: 'active', label: 'Active', color: '#10B981', isSystem: true },
    { name: 'deprecated', label: 'Deprecated', color: '#9CA3AF', isSystem: true },
  ],
  transitions: [
    // Draft rules can be either published (`active`) or shelved
    // (`deprecated`). Shelving a draft is gated by the same perm as
    // shelving an active rule — both routes culminate in the same
    // terminal-but-reversible state and should not collapse onto
    // the generic `compliance-rules.update` permission.
    {
      from: 'draft',
      to: [
        'active',
        { state: 'deprecated', requiredPermissions: ['compliance-rules.deprecate'] },
      ],
    },
    // Deprecating an active rule stops the generator and (per the
    // service layer's `alsoCancelInFlight` opt-in) can cascade
    // cancellation across every non-terminal filing for that rule.
    // Reason + comment ride into the rule's transition history row
    // and downstream filing cancellations so the audit trail explains
    // *why* the cascade happened.
    {
      from: 'active',
      to: [
        {
          state: 'deprecated',
          requiredPermissions: ['compliance-rules.deprecate'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
    // Reactivation reuses the same permission — same blast radius
    // (the rule re-enters the generation pipeline, future filings
    // resume) so the perm and audit-trail requirements stay
    // symmetric with deprecation.
    {
      from: 'deprecated',
      to: [
        {
          state: 'active',
          requiredPermissions: ['compliance-rules.deprecate'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
  ],
});
