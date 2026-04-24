import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { valueProps } from '../schema/value-props';

export const ValuePropRowSchema = createSelectSchema(valueProps);
export const CreateValuePropSchema = createInsertSchema(valueProps, {
  title: (s) => s.min(1),
  description: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateValuePropSchema = CreateValuePropSchema.partial();

export type CreateValuePropDto = z.infer<typeof CreateValuePropSchema>;
export type UpdateValuePropDto = z.infer<typeof UpdateValuePropSchema>;
