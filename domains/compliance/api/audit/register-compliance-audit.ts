import { NotFoundException } from '@nestjs/common';
import { buildAccessContext } from '@packages/rbac';
import type { AuditModuleRegistration, AuditRegistryService } from '@packages/audit';
import type { DataAccessContext } from '@packages/rbac';
import type { JwtPayload } from '@packages/auth-core';

import {
  COMPLIANCE_FILING_GENERATED,
  COMPLIANCE_CLIENT_DORMANTISED,
  COMPLIANCE_REGISTRATION_DEACTIVATED,
  COMPLIANCE_FILINGS_ASSIGNEE_CLEARED,
} from '../events/types';

/**
 * A scope-aware reader for one compliance entity slug. Throws
 * `NotFoundException` when the row doesn't exist OR when the caller's
 * access context excludes it. The audit `authoriseRead` callback uses this
 * to short-circuit "you can read the audit row only if you can read the
 * underlying entity" without depending on entity-engine's per-slug DI tokens.
 */
export type ComplianceEntityReader = (
  id: string,
  accessCtx: DataAccessContext,
) => Promise<unknown>;

const COMPLIANCE_ENTITY_REGISTRATIONS: { slug: string; sensitiveFields?: string[] }[] = [
  { slug: 'clients', sensitiveFields: ['taxId'] },
  { slug: 'client-contacts' },
  { slug: 'client-registrations', sensitiveFields: ['registrationNumber'] },
  { slug: 'laws' },
  { slug: 'compliance-rules' },
  { slug: 'compliance-filings' },
  { slug: 'law-handlers' },
  { slug: 'organizations' },
];

/**
 * Register every compliance-owned module with the audit registry. Per-entity
 * audit reads delegate to the entity's own scope-aware reader, so the user
 * only sees audit rows for entities already visible to them.
 */
export function registerComplianceAudit(
  auditRegistry: AuditRegistryService,
  readers: Map<string, ComplianceEntityReader>,
): void {
  const authoriseRead: AuditModuleRegistration['authoriseRead'] = async ({
    user,
    entityType,
    entityId,
  }) => canReadEntity(readers, user, entityType, entityId);

  for (const { slug, sensitiveFields } of COMPLIANCE_ENTITY_REGISTRATIONS) {
    auditRegistry.register(slug, { events: '*', sensitiveFields, authoriseRead });
  }

  // Custom generator + lifecycle-cascade events. These don't map to a single
  // readable entity, so no authoriseRead — the controller falls back to
  // `audit.read_all`, which is firm-admin only per Q23.
  auditRegistry.register('compliance', {
    events: [
      COMPLIANCE_FILING_GENERATED,
      COMPLIANCE_CLIENT_DORMANTISED,
      COMPLIANCE_REGISTRATION_DEACTIVATED,
      COMPLIANCE_FILINGS_ASSIGNEE_CLEARED,
    ],
  });
}

async function canReadEntity(
  readers: Map<string, ComplianceEntityReader>,
  user: JwtPayload,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const reader = readers.get(entityType);
  if (!reader) return false;

  const readPermission = `${entityType}.read`;
  const accessCtx = buildAccessContext(user, readPermission);
  if (!accessCtx) return false;

  try {
    await reader(entityId, accessCtx);
    return true;
  } catch (error) {
    if (error instanceof NotFoundException) return false;
    throw error;
  }
}
