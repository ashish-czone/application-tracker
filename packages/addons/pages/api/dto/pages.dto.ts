import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { pages } from '../schema/pages';

export const PageRowSchema = createSelectSchema(pages);

export const CreatePageSchema = createInsertSchema(pages, {
  slug: (s) => s.min(1),
  title: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export const UpdatePageSchema = CreatePageSchema.partial();

export type CreatePageDto = z.infer<typeof CreatePageSchema>;
export type UpdatePageDto = z.infer<typeof UpdatePageSchema>;
export type PageRow = z.infer<typeof PageRowSchema>;
