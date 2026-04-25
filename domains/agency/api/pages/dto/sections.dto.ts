import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { sections } from '../schema/sections';

export const SectionRowSchema = createSelectSchema(sections);

export const CreateSectionSchema = createInsertSchema(sections, {
  pageId: (s) => s.min(1),
  blockKind: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateSectionSchema = CreateSectionSchema.partial();

export type CreateSectionDto = z.infer<typeof CreateSectionSchema>;
export type UpdateSectionDto = z.infer<typeof UpdateSectionSchema>;
export type SectionRow = z.infer<typeof SectionRowSchema>;
