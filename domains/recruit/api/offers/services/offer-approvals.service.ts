import { Injectable, NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService, eq, and } from '@packages/database';
import { offerApprovals } from '../schema/offer-approvals';
import { offers } from '../schema/offers';

export interface OfferApproval {
  id: string;
  offerId: string;
  approverId: string;
  decision: string;
  comment: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class OfferApprovalsService {
  constructor(private readonly database: DatabaseService) {}

  async listForOffer(offerId: string): Promise<OfferApproval[]> {
    return this.database.db
      .select()
      .from(offerApprovals)
      .where(eq(offerApprovals.offerId, offerId));
  }

  async createPendingApprovals(offerId: string, approverIds: string[]): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      // Remove existing approvals for this offer
      await tx
        .delete(offerApprovals)
        .where(eq(offerApprovals.offerId, offerId));

      // Create fresh pending approvals
      if (approverIds.length > 0) {
        await tx.insert(offerApprovals).values(
          approverIds.map((approverId) => ({
            offerId,
            approverId,
            decision: 'pending',
          })),
        );
      }
    });
  }

  async submitDecision(
    offerId: string,
    actorId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ): Promise<OfferApproval> {
    // Verify the offer exists and is in pending-approval state
    const [offer] = await this.database.db
      .select({ status: offers.status })
      .from(offers)
      .where(eq(offers.id, offerId));

    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== 'pending-approval') {
      throw new UnprocessableEntityException('Offer is not in pending-approval state');
    }

    // Find the approval row for this actor
    const [approval] = await this.database.db
      .select()
      .from(offerApprovals)
      .where(and(
        eq(offerApprovals.offerId, offerId),
        eq(offerApprovals.approverId, actorId),
      ));

    if (!approval) {
      throw new ForbiddenException('You are not an approver for this offer');
    }

    if (approval.decision !== 'pending') {
      throw new UnprocessableEntityException('You have already submitted your decision');
    }

    // Update the decision
    const [updated] = await this.database.db
      .update(offerApprovals)
      .set({
        decision,
        comment: comment ?? null,
        decidedAt: new Date(),
      })
      .where(eq(offerApprovals.id, approval.id))
      .returning();

    return updated;
  }

  async allApproved(offerId: string): Promise<boolean> {
    const approvals = await this.listForOffer(offerId);
    if (approvals.length === 0) return true; // No approvers required
    return approvals.every((a) => a.decision === 'approved');
  }

  async hasAnyRejection(offerId: string): Promise<boolean> {
    const approvals = await this.listForOffer(offerId);
    return approvals.some((a) => a.decision === 'rejected');
  }
}
