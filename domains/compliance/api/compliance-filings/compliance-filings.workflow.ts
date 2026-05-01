import { defineWorkflow } from '@packages/workflows';

/**
 * Workflow for compliance-filings.status. Lifted out of `defineEntity` per
 * the camp-B decoupling migration. Registered via
 * `WorkflowsModule.forFeature(COMPLIANCE_FILINGS_WORKFLOW)` in
 * `compliance-filings.module.ts`.
 *
 * 6-state workflow with rich transition gating:
 *   - `completed` and `cancelled` are terminal (isSystem); both can be
 *     reopened back to `in_progress` (Q* reopen path)
 *   - All cancellation transitions require reason+comment so the audit row
 *     stands on its own; the same reason+comment ride into the cascade row
 *     when parent dormancy / rule deprecation triggers cancellation
 *   - Per-transition `requiredPermissions` cover pickup/submit/complete/
 *     reject/close/reopen — finer-grained than the bare CRUD perms
 */
export const COMPLIANCE_FILINGS_WORKFLOW = defineWorkflow({
  slug: 'compliance-filing-status',
  entityType: 'compliance-filings',
  fieldName: 'status',
  initialState: 'pending',
  states: [
    { name: 'pending', label: 'Pending', color: '#6B7280' },
    { name: 'in_progress', label: 'In Progress', color: '#3B82F6' },
    { name: 'review', label: 'Review', color: '#8B5CF6' },
    { name: 'rejected', label: 'Rejected', color: '#F59E0B' },
    { name: 'completed', label: 'Completed', color: '#10B981', isSystem: true },
    { name: 'cancelled', label: 'Cancelled', color: '#EF4444', isSystem: true },
  ],
  transitions: [
    {
      from: 'pending',
      to: [
        { state: 'in_progress', requiredPermissions: ['compliance-filings.pickup'] },
        // Cancellation is terminal — capture *why* on every entry path so
        // the audit trail reads standalone. The same reason+comment ride
        // into the cascade row when a parent dormancy / rule deprecation
        // triggers this transition.
        {
          state: 'cancelled',
          requiredPermissions: ['compliance-filings.close'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
    {
      from: 'in_progress',
      to: [
        'pending',
        { state: 'review', requiredPermissions: ['compliance-filings.submit'] },
        {
          state: 'cancelled',
          requiredPermissions: ['compliance-filings.close'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
    {
      from: 'review',
      to: [
        'in_progress',
        {
          // Reviewer signoff: the comment is the explicit "why I'm approving"
          // note that lands on the audit row. Reason is not required because
          // approval has no failure-mode taxonomy (unlike rejection, which
          // surfaces a reason dropdown). One free-text comment is enough.
          state: 'completed',
          requiredPermissions: ['compliance-filings.complete'],
          commentRequired: true,
        },
        {
          state: 'rejected',
          requiredPermissions: ['compliance-filings.reject'],
          reasonRequired: true,
          commentRequired: true,
        },
        {
          state: 'cancelled',
          requiredPermissions: ['compliance-filings.close'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
    {
      from: 'rejected',
      to: [
        'in_progress',
        {
          state: 'cancelled',
          requiredPermissions: ['compliance-filings.close'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
    // Reopen pulls a terminal filing back into the work queue. Both
    // directions need reason+comment so the audit trail captures *why* a
    // closed filing was revived — without that, a `cancelled → in_progress`
    // row reads as an unexplained resurrection in compliance reports.
    {
      from: 'completed',
      to: [
        {
          state: 'in_progress',
          requiredPermissions: ['compliance-filings.reopen'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
    {
      from: 'cancelled',
      to: [
        {
          state: 'in_progress',
          requiredPermissions: ['compliance-filings.reopen'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
  ],
});
