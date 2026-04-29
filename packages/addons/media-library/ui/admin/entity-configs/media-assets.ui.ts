import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const MEDIA_ASSETS_UI_CONFIG: EntityUIConfig = {
  entityType: 'media-assets',
  presentation: {
    singularName: 'Media asset',
    pluralName: 'Media library',
    icon: 'Image',
    navGroup: 'Content',
  },
  fieldUI: {
    originalName: { label: 'File name' },
    mimeType: { label: 'Type' },
    size: { label: 'Size (bytes)' },
    width: { label: 'Width' },
    height: { label: 'Height' },
    storageKey: { label: 'Storage key' },
    url: { label: 'URL' },
    altText: { label: 'Alt text' },
    caption: { label: 'Caption' },
    createdBy: { label: 'Uploaded by' },
    createdAt: { label: 'Uploaded at' },
  },
  listColumns: [
    { fieldKey: 'originalName', visible: true, order: 1 },
    { fieldKey: 'mimeType', visible: true, order: 2 },
    { fieldKey: 'size', visible: true, order: 3 },
    { fieldKey: 'altText', visible: true, order: 4 },
    { fieldKey: 'createdAt', visible: true, order: 5 },
  ],
};
