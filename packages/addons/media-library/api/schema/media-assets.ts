import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';

export const mediaAssets = pgTable('media_assets', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),

  // Storage key returned by @packages/media. Treated as the canonical
  // pointer to the underlying file — `url` below is a convenience
  // copy for reads that don't want to re-resolve via the provider.
  storageKey: text('storage_key').notNull(),
  url: text('url').notNull(),

  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),

  // Image-only metadata. Null for non-image uploads (deferred for V1
  // since we accept images-only, but keeping the columns nullable so
  // a future PDF/video MIME type doesn't require a migration).
  width: integer('width'),
  height: integer('height'),

  altText: text('alt_text'),
  caption: text('caption'),

  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  uniqueIndex('media_assets_storage_key_unique').on(table.storageKey),
  index('media_assets_created_by_idx').on(table.createdBy),
  index('media_assets_mime_type_idx').on(table.mimeType),
  index('media_assets_created_at_idx').on(table.createdAt),
]);
