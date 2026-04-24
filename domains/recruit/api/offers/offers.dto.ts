import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { offers } from './schema/offers';

export const OfferRowSchema = createSelectSchema(offers);

export const CreateOfferSchema = createInsertSchema(offers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateOfferSchema = CreateOfferSchema.partial();

export type CreateOfferDto = z.infer<typeof CreateOfferSchema>;
export type UpdateOfferDto = z.infer<typeof UpdateOfferSchema>;
export type OfferRow = z.infer<typeof OfferRowSchema>;
