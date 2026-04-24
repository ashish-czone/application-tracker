import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { testimonials } from '../schema/testimonials';

export const TestimonialRowSchema = createSelectSchema(testimonials);
export const CreateTestimonialSchema = createInsertSchema(testimonials, {
  quote: (s) => s.min(1),
  authorName: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateTestimonialSchema = CreateTestimonialSchema.partial();

export type CreateTestimonialDto = z.infer<typeof CreateTestimonialSchema>;
export type UpdateTestimonialDto = z.infer<typeof UpdateTestimonialSchema>;
