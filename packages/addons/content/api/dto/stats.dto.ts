import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { stats } from '../schema/stats';

export const StatRowSchema = createSelectSchema(stats);
export const CreateStatSchema = createInsertSchema(stats, {
  label: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateStatSchema = CreateStatSchema.partial();

export type CreateStatDto = z.infer<typeof CreateStatSchema>;
export type UpdateStatDto = z.infer<typeof UpdateStatSchema>;
