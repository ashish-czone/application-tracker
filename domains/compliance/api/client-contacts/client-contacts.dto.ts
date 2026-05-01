import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { clientContacts } from './client-contacts.schema';

export const ClientContactRowSchema = createSelectSchema(clientContacts);

/**
 * Like `CreateClientSchema`, the shared `client_contacts` table exposes a
 * wider column set (linkedinUrl, jobTitle, doNotContact, externalIds, …)
 * than compliance's create payload. The narrow projection below maps the
 * old `compliance.client_contacts` shape onto the new field names per the
 * C-2 mapping table.
 */
export const CreateClientContactSchema = createInsertSchema(clientContacts, {
  primaryEmail: (s) => s.email().max(160).optional(),
  fullName: (s) => s.min(1),
})
  .pick({
    fullName: true,
    primaryEmail: true,
    primaryPhone: true,
    complianceClientId: true,
    complianceDesignation: true,
    complianceIsPrimary: true,
    complianceNotes: true,
  });

export const UpdateClientContactSchema = CreateClientContactSchema.partial();

export type CreateClientContactDto = z.infer<typeof CreateClientContactSchema>;
export type UpdateClientContactDto = z.infer<typeof UpdateClientContactSchema>;
export type ClientContactRow = z.infer<typeof ClientContactRowSchema>;
