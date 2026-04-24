import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { clients } from './schema/clients';

export const ClientRowSchema = createSelectSchema(clients);

export const CreateClientSchema = createInsertSchema(clients, {
  clientName: (s) => s.max(255),
  website: (s) => s.url().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateClientSchema = CreateClientSchema.partial();

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;
export type ClientRow = z.infer<typeof ClientRowSchema>;
