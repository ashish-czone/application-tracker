import { Inject, Injectable } from '@nestjs/common';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { buildFilingExternalKey } from './compliance-filings.config';
import type { CreateComplianceFilingDto, UpdateComplianceFilingDto } from './compliance-filings.dto';

/**
 * Stamps / clears `completedAt` based on the `status` field in the payload:
 * moving TO `completed` stamps now(), moving AWAY clears it. Payloads that
 * don't touch status are returned unchanged. Moved out of the
 * `beforeCreate` / `beforeUpdate` config hooks so the logic lives next to
 * the other create/update behaviour.
 */
function applyCompletedAt(payload: Record<string, unknown>): Record<string, unknown> {
  if (!('status' in payload)) return payload;
  return {
    ...payload,
    completedAt: payload.status === 'completed' ? new Date() : null,
  };
}

@Injectable()
export class ComplianceFilingsService {
  constructor(
    @Inject('ENTITY_SERVICE_compliance-filings') private readonly entityService: EntityService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  /**
   * Derive the externalKey idempotency column from (ruleId, clientId,
   * periodStart) when not explicitly provided, and stamp completedAt
   * based on initial status. These used to live in the `beforeCreate`
   * config hook; moving here keeps all create-time logic in one place.
   */
  create(input: CreateComplianceFilingDto, actorId: string) {
    const withExternalKey = this.ensureExternalKey(input as Record<string, unknown>);
    const finalPayload = applyCompletedAt(withExternalKey);
    return this.entityService.create(finalPayload, actorId);
  }

  update(id: string, input: UpdateComplianceFilingDto, actorId: string, accessCtx?: DataAccessContext) {
    const finalPayload = applyCompletedAt(input as Record<string, unknown>);
    return this.entityService.update(id, finalPayload, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }

  private ensureExternalKey(payload: Record<string, unknown>): Record<string, unknown> {
    const ruleId = payload.ruleId as string | undefined;
    const clientId = payload.clientId as string | undefined;
    const periodStart = payload.periodStart as string | undefined;
    if (!ruleId || !clientId || !periodStart || payload.externalKey != null) {
      return payload;
    }
    return {
      ...payload,
      externalKey: buildFilingExternalKey(ruleId, clientId, periodStart),
    };
  }
}
