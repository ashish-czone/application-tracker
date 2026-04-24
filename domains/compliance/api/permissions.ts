import type { PermissionManifest } from '@packages/rbac';

/**
 * Compliance domain permission constants.
 *
 * The entity-engine auto-registers CRUD permissions for every declared entity
 * (clients, client-contacts, client-registrations, laws, compliance_rules,
 * law-handlers — see compliance.module.ts). The constants below cover the UI
 * surfaces that don't yet have backing entities (filings, reports). Once
 * those become real entities, the auto-registered CRUD perms supersede these
 * and the constants can be removed.
 *
 * Keep these in sync with the route-level permissions declared in
 * `domains/compliance/ui/index.tsx`.
 */
export const COMPLIANCE_PERMISSIONS = {
  FILINGS_READ: 'filings.read',
  FILINGS_CREATE: 'filings.create',
  FILINGS_UPDATE: 'filings.update',
  FILINGS_DELETE: 'filings.delete',
  REPORTS_READ: 'reports.read',
} as const;

export type CompliancePermission =
  (typeof COMPLIANCE_PERMISSIONS)[keyof typeof COMPLIANCE_PERMISSIONS];

/**
 * Permission manifests consumed by compliance.module.ts's onModuleInit().
 * These are non-entity UI surfaces — entity CRUD perms come from the
 * entity-engine's auto-derivation.
 */
export const COMPLIANCE_PERMISSION_MANIFESTS: PermissionManifest[] = [
  { slug: 'filings.read',   module: 'filings', action: 'read',   label: 'View filings',   description: 'View compliance filings',   supportedScopes: ['any'] },
  { slug: 'filings.create', module: 'filings', action: 'create', label: 'Create filings', description: 'Create compliance filings', supportedScopes: ['any'] },
  { slug: 'filings.update', module: 'filings', action: 'update', label: 'Update filings', description: 'Update compliance filings', supportedScopes: ['any'] },
  { slug: 'filings.delete', module: 'filings', action: 'delete', label: 'Delete filings', description: 'Delete compliance filings', supportedScopes: ['any'] },
  { slug: 'reports.read',   module: 'reports', action: 'read',   label: 'View reports',   description: 'View compliance reports',   supportedScopes: ['any'] },
];
