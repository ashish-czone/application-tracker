import { defineWorkflow } from '@packages/workflows';

/**
 * Workflow for clients.complianceStatus. Lifted out of `defineEntity` per
 * the camp-B decoupling migration. Registered via
 * `WorkflowsModule.forFeature(CLIENTS_WORKFLOW)` in `clients.module.ts`.
 *
 * State names are code-load-bearing: `ClientsService.CLIENT_GUARDS` and
 * `client-registrations.service` filter on these names. Renaming any of
 * them silently breaks domain logic — isSystem locks the identifier in
 * the admin UI (label/color stay editable).
 */
export const CLIENTS_WORKFLOW = defineWorkflow({
  slug: 'client-status',
  entityType: 'clients',
  fieldName: 'complianceStatus',
  initialState: 'onboarding',
  states: [
    { name: 'onboarding', label: 'Onboarding', color: '#F59E0B', isSystem: true },
    { name: 'active', label: 'Active', color: '#10B981', isSystem: true },
    { name: 'dormant', label: 'Dormant', color: '#6B7280', isSystem: true },
  ],
  transitions: [
    // Guards (require-primary-contact, compliance-client-dormancy-warning)
    // live in ClientsService.CLIENT_GUARDS — the workflow definition only
    // describes legal transitions and which require reason/comment.
    { from: 'onboarding', to: ['active'] },
    // Dormancy is destructive per Q6: it cascades `cancelled` across every
    // non-terminal filing for this client inside the transition tx. Forcing
    // a reason + comment makes the admin articulate *why* and that
    // explanation propagates into each filing's workflow history so the
    // audit trail reads standalone on every row. `clients.dormantise` gates
    // the perm so junior users with plain `clients.update` can edit the
    // client record without being able to trigger the cascade.
    {
      from: 'active',
      to: [
        {
          state: 'dormant',
          requiredPermissions: ['clients.dormantise'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
    // Reactivation is symmetric: same perm, same reason/comment requirements.
    {
      from: 'dormant',
      to: [
        {
          state: 'active',
          requiredPermissions: ['clients.dormantise'],
          reasonRequired: true,
          commentRequired: true,
        },
      ],
    },
  ],
});
