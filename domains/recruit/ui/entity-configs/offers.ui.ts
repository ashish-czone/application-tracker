import type { EntityUIConfig } from '@packages/entity-engine-ui';
import { OfferApprovalPanel } from '../portals/recruiter/features/offers/OfferApprovalPanel';

export const OFFERS_UI_CONFIG: EntityUIConfig = {
  entityType: 'offers',
  presentation: {
    icon: 'file-signature',
    navGroup: 'recruit',
    navOrder: 4,
  },
  detailPlugins: [
    { component: OfferApprovalPanel as any, label: 'Approval Chain', order: 0 },
  ],
};
