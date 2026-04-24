import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { clientContacts } from '../schema/client-contacts';

export const ClientContactRowSchema = createSelectSchema(clientContacts);

export const CreateClientContactSchema = createInsertSchema(clientContacts, {
  email: (s) => s.email().max(160).optional(),
  name: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateClientContactSchema = CreateClientContactSchema.partial();

export type CreateClientContactDto = z.infer<typeof CreateClientContactSchema>;
export type UpdateClientContactDto = z.infer<typeof UpdateClientContactSchema>;
export type ClientContactRow = z.infer<typeof ClientContactRowSchema>;
