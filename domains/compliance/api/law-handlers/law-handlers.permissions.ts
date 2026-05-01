import { crudPermissionManifests, type PermissionManifest } from '@packages/rbac';

/**
 * Permission manifests for law-handlers. Migrated out of `defineEntity`
 * per the camp-B decoupling (sprint 5). Registered via
 * `RbacIntegrationModule.forFeature` in `law-handlers.module.ts`.
 */
export const LAW_HANDLERS_PERMISSION_MANIFESTS: PermissionManifest[] = [
  ...crudPermissionManifests({ module: 'law-handlers', entityName: 'law handler' }),
];
