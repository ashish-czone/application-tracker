import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { mediaAssets } from '../schema/media-assets';

export const MediaAssetRowSchema = createSelectSchema(mediaAssets);

export const CreateMediaAssetSchema = createInsertSchema(mediaAssets, {
  storageKey: (s) => s.min(1),
  url: (s) => s.min(1),
  originalName: (s) => s.min(1),
  mimeType: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export const UpdateMediaAssetSchema = CreateMediaAssetSchema.partial();

export type CreateMediaAssetDto = z.infer<typeof CreateMediaAssetSchema>;
export type UpdateMediaAssetDto = z.infer<typeof UpdateMediaAssetSchema>;
export type MediaAssetRow = z.infer<typeof MediaAssetRowSchema>;
