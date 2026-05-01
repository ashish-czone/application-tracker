import { crudPermissionManifests, type PermissionManifest } from '@packages/rbac';

/**
 * Permission manifests for laws. Migrated out of `defineEntity` per the
 * camp-B decoupling (sprint 5). Registered via
 * `RbacIntegrationModule.forFeature` in `laws.module.ts`.
 */
export const LAWS_PERMISSION_MANIFESTS: PermissionManifest[] = [
  ...crudPermissionManifests({ module: 'laws', entityName: 'law' }),
];
