import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { services } from '../schema/services';

export const ServiceRowSchema = createSelectSchema(services);
export const CreateServiceSchema = createInsertSchema(services, {
  name: (s) => s.min(1),
  description: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateServiceSchema = CreateServiceSchema.partial();

export type CreateServiceDto = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceDto = z.infer<typeof UpdateServiceSchema>;
