import { crudPermissionManifests, type PermissionManifest } from '@packages/rbac';

/**
 * Permission manifests for client-registrations. Migrated out of
 * `defineEntity` per the camp-B decoupling (sprint 5). Registered via
 * `RbacIntegrationModule.forFeature` in `client-registrations.module.ts`.
 */
export const CLIENT_REGISTRATIONS_PERMISSION_MANIFESTS: PermissionManifest[] = [
  ...crudPermissionManifests({ module: 'client-registrations', entityName: 'client registration' }),
];
