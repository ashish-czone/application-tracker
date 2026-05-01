import { crudPermissionManifests, type PermissionManifest } from '@packages/rbac';

/**
 * Permission manifests for compliance-filings. Migrated out of `defineEntity`
 * per the camp-B decoupling (stretch sprint after sprint 5). Registered via
 * `RbacIntegrationModule.forFeature` in `compliance-filings.module.ts`.
 *
 * The `supportedScopes` array below mirrors what `deriveSupportedScopes`
 * would produce for this entity given:
 *   - anchors: creator, assignee, team
 *   - inline scopes: unassigned_in_unit
 *   - registered scope resolvers (rbac built-in + org-units):
 *       own (requires creator) ✓ matched
 *       assigned (requires assignee) ✓ matched
 *       unit (requires creator|assignee|team) ✓ matched
 *       descendants (requires creator|assignee|team) ✓ matched
 *
 * If a new scope resolver lands that requires only anchors filings already
 * declares (or no anchors at all), this list must be extended. There is no
 * runtime cross-check between the static list here and the registered
 * resolver registry — that's the cost of moving registration off the
 * auto-derivation path. A future helper (`scopedCrudPermissionManifests`)
 * could derive these from a static input matching the same shape and
 * eliminate the manual sync.
 */
const FILINGS_SUPPORTED_SCOPES: string[] = [
  'any',
  'own',
  'assigned',
  'unit',
  'descendants',
  'unassigned_in_unit',
];

const FILINGS_EXTRA_PERMISSIONS: PermissionManifest[] = [
  {
    slug: 'compliance-filings.pickup',
    module: 'compliance-filings',
    action: 'pickup',
    label: 'Pick up filings',
    description: 'Pick up a pending filing and move it to in-progress',
    supportedScopes: FILINGS_SUPPORTED_SCOPES,
  },
  {
    slug: 'compliance-filings.submit',
    module: 'compliance-filings',
    action: 'submit',
    label: 'Submit filings',
    description: 'Submit an in-progress filing for review',
    supportedScopes: FILINGS_SUPPORTED_SCOPES,
  },
  {
    slug: 'compliance-filings.complete',
    module: 'compliance-filings',
    action: 'complete',
    label: 'Complete filings',
    description: 'Approve a filing in review and mark it completed',
    supportedScopes: FILINGS_SUPPORTED_SCOPES,
  },
  {
    slug: 'compliance-filings.reject',
    module: 'compliance-filings',
    action: 'reject',
    label: 'Reject filings',
    description: 'Reject a filing in review back to the preparer',
    supportedScopes: FILINGS_SUPPORTED_SCOPES,
  },
  {
    slug: 'compliance-filings.reopen',
    module: 'compliance-filings',
    action: 'reopen',
    label: 'Reopen filings',
    description: 'Reopen completed or cancelled filings',
    supportedScopes: FILINGS_SUPPORTED_SCOPES,
  },
  {
    slug: 'compliance-filings.close',
    module: 'compliance-filings',
    action: 'close',
    label: 'Close filings',
    description: 'Cancel a non-terminal filing',
    supportedScopes: FILINGS_SUPPORTED_SCOPES,
  },
];

export const COMPLIANCE_FILINGS_PERMISSION_MANIFESTS: PermissionManifest[] = [
  ...crudPermissionManifests({
    module: 'compliance-filings',
    entityName: 'filing',
    supportedScopes: FILINGS_SUPPORTED_SCOPES,
  }),
  ...FILINGS_EXTRA_PERMISSIONS,
];
