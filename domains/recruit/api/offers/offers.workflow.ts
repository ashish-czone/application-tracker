import { defineWorkflow } from '@packages/workflows';

/**
 * Workflow for offers.status. Lifted out of the entity config per the
 * camp-B decoupling migration. Registered via
 * `WorkflowsModule.forFeature(OFFERS_WORKFLOW)` in `offers.module.ts`.
 *
 * draft, pending-approval, approved are code-load-bearing:
 *   - 'draft' is the offers.status column default
 *   - OfferApprovalsService gates submission on status === 'pending-approval'
 *   - OFFER_GUARDS branches on the pending-approval → approved transition
 */
export const OFFERS_WORKFLOW = defineWorkflow({
  slug: 'offer-status',
  entityType: 'offers',
  fieldName: 'status',
  initialState: 'draft',
  states: [
    { name: 'draft', label: 'Draft', color: '#6B7280', isSystem: true },
    { name: 'pending-approval', label: 'Pending Approval', color: '#F59E0B', isSystem: true },
    { name: 'approved', label: 'Approved', color: '#3B82F6', isSystem: true },
    { name: 'sent', label: 'Sent', color: '#8B5CF6' },
    { name: 'accepted', label: 'Accepted', color: '#10B981' },
    { name: 'declined', label: 'Declined', color: '#EF4444' },
    { name: 'expired', label: 'Expired', color: '#9CA3AF' },
  ],
  transitions: [
    { from: 'draft', to: ['pending-approval'] },
    // Guard (require-offer-approvals) lives in OffersService.OFFER_GUARDS.
    { from: 'pending-approval', to: ['approved', 'draft'] },
    { from: 'approved', to: ['sent'] },
    { from: 'sent', to: ['accepted', 'declined', 'expired'] },
  ],
});
