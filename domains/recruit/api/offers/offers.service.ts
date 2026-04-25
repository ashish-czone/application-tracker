import { BadRequestException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import {
  runTransitionGuards,
  previewTransitionGuards,
  type TransitionGuard,
} from '@packages/workflows';
import type { CreateOfferDto, UpdateOfferDto } from './offers.dto';
import { OfferApprovalsService } from './services/offer-approvals.service';

interface OfferGuardDeps {
  approvals: OfferApprovalsService;
}

type OfferRow = Record<string, unknown> & { id: string };

const OFFER_GUARDS: TransitionGuard<OfferRow, OfferGuardDeps>[] = [
  {
    name: 'require-offer-approvals',
    from: 'pending-approval',
    to: 'approved',
    check: async (offer, { deps }) => {
      const allApproved = await deps.approvals.allApproved(offer.id);
      if (!allApproved) {
        throw new UnprocessableEntityException(
          'All approvers must approve this offer before it can move to Approved.',
        );
      }
    },
  },
];

@Injectable()
export class OffersService {
  constructor(
    @Inject('ENTITY_SERVICE_offers') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly approvals: OfferApprovalsService,
  ) {}

  private guardDeps(): OfferGuardDeps {
    return { approvals: this.approvals };
  }

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  create(input: CreateOfferDto, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: UpdateOfferDto, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.update(id, input, actorId, accessCtx);
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

  async transition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ): Promise<Record<string, unknown>> {
    const entity = await this.entityService.findOneOrFail(id, accessCtx);
    const fromState = entity[fieldKey] as string | null;
    if (!fromState) {
      throw new BadRequestException(`Entity has no current state for field '${fieldKey}'`);
    }

    const warnings = fieldKey === 'status'
      ? await runTransitionGuards(OFFER_GUARDS, entity as OfferRow, {
          fromState, toState, actor: actorId, deps: this.guardDeps(),
        })
      : [];

    const ctx = await this.entityService.validateTransition(
      id, fieldKey, toState, actorId, options, accessCtx,
    );

    await this.database.db.transaction(async (tx) => {
      await this.entityService.applyTransition(ctx, tx);
    });
    this.entityService.emitTransitionEvent(ctx);

    const fresh = await this.entityService.findOneOrFail(id);
    return warnings.length > 0 ? { ...fresh, warnings } : fresh;
  }

  async previewTransition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    accessCtx?: DataAccessContext,
  ): Promise<{ warnings: string[]; blockers: string[] }> {
    if (fieldKey !== 'status') return { warnings: [], blockers: [] };
    const entity = await this.entityService.findOneOrFail(id, accessCtx);
    const fromState = entity[fieldKey] as string | null;
    if (!fromState) return { warnings: [], blockers: [] };
    return previewTransitionGuards(OFFER_GUARDS, entity as OfferRow, {
      fromState, toState, actor: actorId, deps: this.guardDeps(),
    });
  }
}
