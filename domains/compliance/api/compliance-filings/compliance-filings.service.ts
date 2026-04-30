import { Inject, Injectable } from '@nestjs/common';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { LawsService } from '../laws/laws.service';
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

function collectLawIds(rows: ReadonlyArray<Record<string, unknown>>): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = row.lawId;
    if (typeof id === 'string' && id.length > 0) ids.add(id);
  }
  return ids;
}

@Injectable()
export class ComplianceFilingsService {
  constructor(
    @Inject('ENTITY_SERVICE_compliance-filings') private readonly entityService: EntityService,
    private readonly lawsService: LawsService,
  ) {}

  /**
   * List filings with embedded law display fields (`lawCode`, `lawName`,
   * `lawJurisdiction`) per row. The entity engine already injects `__label`
   * fields for lookup columns (clientId, lawId, ruleId, assigneeTeamId,
   * assigneeId), but lookup labels are single-valued; the dashboard widgets
   * and list page need the law's code AND jurisdiction together. We resolve
   * those via a single batched call to LawsService — service composition
   * across modules, never a JOIN.
   */
  async list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    const result = await this.entityService.list(query, accessCtx);
    const lawIds = collectLawIds(result.data);
    if (lawIds.size === 0) return result;

    const laws = await this.lawsService.findDisplayByIds([...lawIds]);
    const byId = new Map(laws.map((l) => [l.id, l]));

    return {
      ...result,
      data: result.data.map((row) => {
        const lawId = typeof row.lawId === 'string' ? row.lawId : null;
        const law = lawId ? byId.get(lawId) : undefined;
        if (!law) return row;
        return {
          ...row,
          lawCode: law.code,
          lawName: law.name,
          lawJurisdiction: law.jurisdiction,
        };
      }),
    };
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

  /**
   * Generic workflow transition. The filing workflow has many transitions
   * (pending → in_progress, in_progress → review, review → completed/rejected,
   * etc.); the engine carries permission checks and history rows so this
   * service stays a thin pass-through.
   */
  transition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ) {
    return this.entityService.transition(id, fieldKey, toState, actorId, options, accessCtx);
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
