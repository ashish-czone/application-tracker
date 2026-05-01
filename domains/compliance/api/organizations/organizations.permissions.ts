import { crudPermissionManifests, type PermissionManifest } from '@packages/rbac';

/**
 * Permission manifests for organizations. Migrated out of `defineEntity`
 * per the camp-B decoupling (sprint 5). Registered via
 * `RbacIntegrationModule.forFeature` in `organizations.module.ts`.
 */
export const ORGANIZATIONS_PERMISSION_MANIFESTS: PermissionManifest[] = [
  ...crudPermissionManifests({ module: 'organizations', entityName: 'organization' }),
];
