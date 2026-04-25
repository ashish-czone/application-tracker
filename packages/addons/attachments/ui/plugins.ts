import type { DetailTabPlugin, RightSidebarPanel } from '@packages/entity-engine-ui';
import { AttachmentsSection } from './components/AttachmentsSection';
import { readAttachmentsFeature } from './feature';

export const attachmentsDetailTab: DetailTabPlugin = {
  key: 'attachments',
  label: 'Attachments',
  order: 200,
  component: AttachmentsSection,
  enabledFor: (entity) => !!readAttachmentsFeature(entity.features),
};

export const attachmentsSidebarPanel: RightSidebarPanel = {
  key: 'files',
  label: 'Files',
  order: 200,
  component: AttachmentsSection,
  enabledFor: (entity) => !!readAttachmentsFeature(entity.features),
};
