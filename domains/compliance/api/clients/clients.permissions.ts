import { crudPermissionManifests, type PermissionManifest } from '@packages/rbac';

/**
 * Permission manifests for clients. Migrated out of `defineEntity` per
 * the camp-B decoupling (sprint 5). Registered via
 * `RbacIntegrationModule.forFeature` in `clients.module.ts`.
 */
export const CLIENTS_PERMISSION_MANIFESTS: PermissionManifest[] = [
  ...crudPermissionManifests({ module: 'clients', entityName: 'client' }),
  {
    slug: 'clients.dormantise',
    module: 'clients',
    action: 'dormantise',
    label: 'Dormantise clients',
    description:
      'Move a client between active and dormant. Required for both directions of the destructive transition that cancels in-flight filings on entry and re-opens the pipeline on reversal.',
    supportedScopes: ['any'],
  },
];
