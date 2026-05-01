import type { PermissionManifest } from './permission-manifest';

export interface CrudPermissionManifestOptions {
  /** Module slug, joined with each action to form the permission slug. e.g. `compliance-rules`. */
  module: string;
  /** Singular display noun used in description text, e.g. `rule`. */
  entityName: string;
  /** Plural form for descriptions (defaults to `${entityName}s`). */
  entityPlural?: string;
  /** Scopes each generated permission supports (defaults to `['any']`). */
  supportedScopes?: string[];
}

/**
 * Generate the standard 4 CRUD permission manifests for an entity. Result
 * is the array of read/create/update/delete manifests; merge with any
 * extra non-CRUD permissions and pass to `RbacIntegrationModule.forFeature`.
 *
 * Replaces the auto-derivation that lives inside `defineEntity` today: as
 * entities migrate off defineEntity, each module declares its CRUD
 * permissions explicitly via this helper plus an extras array.
 *
 * @example
 *   // rules.permissions.ts
 *   import { crudPermissionManifests } from '@packages/rbac';
 *
 *   export const RULES_PERMISSION_MANIFESTS: PermissionManifest[] = [
 *     ...crudPermissionManifests({ module: 'compliance-rules', entityName: 'rule' }),
 *     {
 *       slug: 'compliance-rules.deprecate',
 *       module: 'compliance-rules',
 *       action: 'deprecate',
 *       label: 'Deprecate rules',
 *       description: 'Deprecate a rule and (optionally) cancel in-flight filings',
 *       supportedScopes: ['any'],
 *     },
 *   ];
 *
 *   // rules.module.ts
 *   @Module({
 *     imports: [
 *       RbacIntegrationModule.forFeature({ manifests: RULES_PERMISSION_MANIFESTS }),
 *     ],
 *   })
 */
export function crudPermissionManifests(opts: CrudPermissionManifestOptions): PermissionManifest[] {
  const { module } = opts;
  const plural = opts.entityPlural ?? `${opts.entityName}s`;
  const supportedScopes = opts.supportedScopes ?? ['any'];

  return [
    {
      slug: `${module}.read`,
      module,
      action: 'read',
      label: `View ${plural}`,
      description: `View ${plural}`,
      supportedScopes,
    },
    {
      slug: `${module}.create`,
      module,
      action: 'create',
      label: `Create ${plural}`,
      description: `Create ${plural}`,
      supportedScopes,
    },
    {
      slug: `${module}.update`,
      module,
      action: 'update',
      label: `Update ${plural}`,
      description: `Update ${plural}`,
      supportedScopes,
    },
    {
      slug: `${module}.delete`,
      module,
      action: 'delete',
      label: `Delete ${plural}`,
      description: `Delete ${plural}`,
      supportedScopes,
    },
  ];
}
