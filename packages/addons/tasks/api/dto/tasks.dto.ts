import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { tasks } from '../schema/tasks';

export const TaskRowSchema = createSelectSchema(tasks);

export const CreateTaskSchema = createInsertSchema(tasks, {
  title: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;
export type TaskRow = z.infer<typeof TaskRowSchema>;
