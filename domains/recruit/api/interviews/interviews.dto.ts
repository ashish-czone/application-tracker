import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { interviews } from './schema/interviews';

export const InterviewRowSchema = createSelectSchema(interviews);

export const CreateInterviewSchema = createInsertSchema(interviews, {
  videoLink: (s) => s.url().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateInterviewSchema = CreateInterviewSchema.partial();

export type CreateInterviewDto = z.infer<typeof CreateInterviewSchema>;
export type UpdateInterviewDto = z.infer<typeof UpdateInterviewSchema>;
export type InterviewRow = z.infer<typeof InterviewRowSchema>;
