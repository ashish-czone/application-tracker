import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from '../schema/projects';

export const ProjectRowSchema = createSelectSchema(projects);

export const CreateProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export const TransitionProjectSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;
export type TransitionProjectDto = z.infer<typeof TransitionProjectSchema>;
export type ProjectRow = z.infer<typeof ProjectRowSchema>;
