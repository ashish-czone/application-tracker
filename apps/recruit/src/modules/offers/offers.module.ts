import { Module, type OnModuleInit } from '@nestjs/common';
import { WorkflowGuardRegistry } from '@packages/workflows';
import { OfferApprovalsService } from './services/offer-approvals.service';
import { OfferApprovalsController } from './controllers/offer-approvals.controller';

@Module({
  controllers: [OfferApprovalsController],
  providers: [OfferApprovalsService],
})
export class OffersModule implements OnModuleInit {
  constructor(
    private readonly guardRegistry: WorkflowGuardRegistry,
    private readonly approvalsService: OfferApprovalsService,
  ) {}

  onModuleInit() {
    // Register guard: blocks pending-approval → approved unless all approvers approved
    this.guardRegistry.register('require-offer-approvals', async (ctx) => {
      if (ctx.entityType !== 'offers') return true;
      if (ctx.toState !== 'approved') return true;
      return this.approvalsService.allApproved(ctx.entityId);
    });
  }
}
