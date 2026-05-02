import { crudPermissionManifests, type PermissionManifest } from '@packages/rbac';

/**
 * Permission manifests for compliance-rules. Registered via
 * `RbacIntegrationModule.forFeature` in `rules.module.ts`. Originally
 * lived in `defineEntity({ extraPermissions })`; the entity-engine
 * config was retired entirely in the workflow-lift effort.
 */
export const RULES_PERMISSION_MANIFESTS: PermissionManifest[] = [
  ...crudPermissionManifests({ module: 'compliance-rules', entityName: 'rule' }),
  {
    slug: 'compliance-rules.deprecate',
    module: 'compliance-rules',
    action: 'deprecate',
    label: 'Deprecate rules',
    description:
      'Deprecate a compliance rule and (optionally) cancel every in-flight filing generated from it. Required for both directions of the destructive `* ↔ deprecated` transition; reuse the same perm for reactivation so admins who can retire a rule can reverse it.',
    supportedScopes: ['any'],
  },
];
