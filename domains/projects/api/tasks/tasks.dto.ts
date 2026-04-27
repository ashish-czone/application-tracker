import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { tasks } from '../schema/tasks';

export const TaskRowSchema = createSelectSchema(tasks);

export const CreateTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export const TransitionTaskSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;
export type TransitionTaskDto = z.infer<typeof TransitionTaskSchema>;
export type TaskRow = z.infer<typeof TaskRowSchema>;
