import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { milestones } from '../schema/milestones';

export const MilestoneRowSchema = createSelectSchema(milestones);

export const CreateMilestoneSchema = createInsertSchema(milestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export const UpdateMilestoneSchema = CreateMilestoneSchema.partial();

export const TransitionMilestoneSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

export type CreateMilestoneDto = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneDto = z.infer<typeof UpdateMilestoneSchema>;
export type TransitionMilestoneDto = z.infer<typeof TransitionMilestoneSchema>;
export type MilestoneRow = z.infer<typeof MilestoneRowSchema>;
