import { defineEntity } from '@packages/entity-engine';
import { mediaAssets } from './schema/media-assets';

/**
 * MediaAsset — one row per uploaded file. Rows are created by the
 * composite upload endpoint, not by a generic create form (the CRUD
 * create endpoint remains available for API callers / seeds, but the
 * admin UI surfaces upload + metadata edit only).
 *
 * Fields with `system: true, readonly: true` come from the upload
 * pipeline (storageKey, url, mimeType, size, width, height) — users
 * never edit them. altText / caption are the only user-editable
 * fields post-upload.
 */
export const MEDIA_ASSETS_CONFIG = defineEntity({
  table: mediaAssets,
  slug: 'media-assets',
  timestamps: true,

  fields: {
    originalName: {
      type: 'text',
      label: 'File name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      system: true,
      readonly: true,
    },
    mimeType: {
      type: 'text',
      label: 'Type',
      required: true,
      sortable: true,
      listVisible: true,
      listOrder: 2,
      system: true,
      readonly: true,
    },
    size: {
      type: 'number',
      label: 'Size (bytes)',
      required: true,
      sortable: true,
      listVisible: true,
      listOrder: 3,
      system: true,
      readonly: true,
    },
    width: {
      type: 'number',
      label: 'Width',
      system: true,
      readonly: true,
    },
    height: {
      type: 'number',
      label: 'Height',
      system: true,
      readonly: true,
    },
    storageKey: {
      type: 'text',
      label: 'Storage key',
      required: true,
      system: true,
      readonly: true,
    },
    url: {
      type: 'url',
      label: 'URL',
      required: true,
      system: true,
      readonly: true,
    },
    altText: {
      type: 'text',
      label: 'Alt text',
      searchable: true,
      listVisible: true,
      listOrder: 4,
    },
    caption: {
      type: 'textarea',
      label: 'Caption',
      searchable: true,
    },
    createdBy: {
      type: 'user',
      label: 'Uploaded by',
      system: true,
      readonly: true,
    },
    createdAt: {
      type: 'datetime',
      label: 'Uploaded at',
      system: true,
      readonly: true,
      sortable: true,
      listVisible: true,
      listOrder: 5,
    },
  },

  defaultSort: 'createdAt',
});
