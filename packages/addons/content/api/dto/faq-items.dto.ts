import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { faqItems } from '../schema/faq-items';

export const FaqItemRowSchema = createSelectSchema(faqItems);
export const CreateFaqItemSchema = createInsertSchema(faqItems, {
  question: (s) => s.min(1),
  answer: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateFaqItemSchema = CreateFaqItemSchema.partial();

export type CreateFaqItemDto = z.infer<typeof CreateFaqItemSchema>;
export type UpdateFaqItemDto = z.infer<typeof UpdateFaqItemSchema>;
