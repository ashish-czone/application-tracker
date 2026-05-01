import { crudPermissionManifests, type PermissionManifest } from '@packages/rbac';

/**
 * Permission manifests for client-contacts. Migrated out of `defineEntity`
 * per the camp-B decoupling (sprint 5). Registered via
 * `RbacIntegrationModule.forFeature` in `client-contacts.module.ts`.
 */
export const CLIENT_CONTACTS_PERMISSION_MANIFESTS: PermissionManifest[] = [
  ...crudPermissionManifests({ module: 'client-contacts', entityName: 'client contact' }),
];
