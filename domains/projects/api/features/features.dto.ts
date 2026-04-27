import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { features } from '../schema/features';

export const FeatureRowSchema = createSelectSchema(features);

export const CreateFeatureSchema = createInsertSchema(features).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateFeatureSchema = CreateFeatureSchema.partial();

export const TransitionFeatureSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

export type CreateFeatureDto = z.infer<typeof CreateFeatureSchema>;
export type UpdateFeatureDto = z.infer<typeof UpdateFeatureSchema>;
export type TransitionFeatureDto = z.infer<typeof TransitionFeatureSchema>;
export type FeatureRow = z.infer<typeof FeatureRowSchema>;
