import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { contacts } from './schema/contacts';

export const ContactRowSchema = createSelectSchema(contacts);

export const CreateContactSchema = createInsertSchema(contacts, {
  email: (s) => s.email().max(120).optional(),
  secondaryEmail: (s) => s.email().max(120).optional(),
  linkedinUrl: (s) => s.url().optional(),
  facebookUrl: (s) => s.url().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateContactSchema = CreateContactSchema.partial();

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;
export type ContactRow = z.infer<typeof ContactRowSchema>;
