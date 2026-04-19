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
 * The string format mirrors the entity-engine convention: `<module>.<action>`.
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

interface PermissionRegistration {
  module: string;
  action: string;
  description: string;
}

/**
 * Registry payload consumed by `compliance.module.ts`'s `onModuleInit()`.
 * Grouped by module so each can be passed to `registerPermissions(module, ...)`.
 */
export const COMPLIANCE_PERMISSION_REGISTRATIONS: PermissionRegistration[] = [
  { module: 'filings', action: 'read', description: 'View compliance filings' },
  { module: 'filings', action: 'create', description: 'Create compliance filings' },
  { module: 'filings', action: 'update', description: 'Update compliance filings' },
  { module: 'filings', action: 'delete', description: 'Delete compliance filings' },
  { module: 'reports', action: 'read', description: 'View compliance reports' },
];
