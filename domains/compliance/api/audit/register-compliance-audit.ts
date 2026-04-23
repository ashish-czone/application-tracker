import { NotFoundException } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import {
  EntityService,
  POSITION_SCOPE_PROVIDER,
  buildAccessContext,
  type PositionScopeProvider,
} from '@packages/entity-engine';
import type { AuditModuleRegistration, AuditRegistryService } from '@packages/audit';
import type { JwtPayload } from '@packages/auth-core';

import { COMPLIANCE_TASK_GENERATED, COMPLIANCE_FILING_GENERATED } from '../events/types';

/**
 * Every compliance-owned event namespace that should land in `audit_logs`.
 * Order follows Q22 in domains/compliance/todos.md: one registration per slug
 * (entity type), plus one for the custom `compliance.*` generator events.
 */
const COMPLIANCE_ENTITY_REGISTRATIONS: { slug: string; sensitiveFields?: string[] }[] = [
  { slug: 'clients', sensitiveFields: ['taxId'] },
  { slug: 'client-contacts' },
  { slug: 'client-registrations', sensitiveFields: ['registrationNumber'] },
  { slug: 'laws' },
  { slug: 'compliance_rules' },
  { slug: 'compliance-filings' },
  { slug: 'compliance_law_handlers' },
  { slug: 'organization' },
];

/**
 * Register every compliance-owned module with the audit registry. Per-entity
 * audit reads delegate to the entity's own scope-aware `findOneOrFail`, so the
 * user only sees audit rows for entities already visible to them.
 */
export function registerComplianceAudit(
  auditRegistry: AuditRegistryService,
  moduleRef: ModuleRef,
): void {
  const authoriseRead: AuditModuleRegistration['authoriseRead'] = async ({
    user,
    entityType,
    entityId,
  }) => canReadEntity(moduleRef, user, entityType, entityId);

  for (const { slug, sensitiveFields } of COMPLIANCE_ENTITY_REGISTRATIONS) {
    auditRegistry.register(slug, { events: '*', sensitiveFields, authoriseRead });
  }

  // Custom generator events (`compliance.ComplianceFilingGenerated`,
  // `compliance.ComplianceTaskGenerated`). These don't map to a single
  // readable entity, so no authoriseRead — the controller falls back to
  // `audit.read_all`, which is firm-admin only per Q23.
  auditRegistry.register('compliance', {
    events: [COMPLIANCE_TASK_GENERATED, COMPLIANCE_FILING_GENERATED],
  });
}

async function canReadEntity(
  moduleRef: ModuleRef,
  user: JwtPayload,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const entityService = safeGet<EntityService>(moduleRef, `ENTITY_SERVICE_${entityType}`);
  if (!entityService) return false;

  const positionScopeProvider = safeGet<PositionScopeProvider>(moduleRef, POSITION_SCOPE_PROVIDER);
  const readPermission = `${entityType}.read`;
  const accessCtx = await buildAccessContext(
    user,
    readPermission,
    entityType,
    positionScopeProvider ?? null,
  );
  if (!accessCtx) return false;

  try {
    await entityService.findOneOrFail(entityId, accessCtx);
    return true;
  } catch (error) {
    if (error instanceof NotFoundException) return false;
    throw error;
  }
}

function safeGet<T>(moduleRef: ModuleRef, token: string | symbol): T | null {
  try {
    return moduleRef.get<T>(token as never, { strict: false });
  } catch {
    return null;
  }
}
