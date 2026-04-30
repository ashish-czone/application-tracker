import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { clients } from './clients-ref';

export const ClientRowSchema = createSelectSchema(clients);

/**
 * The shared `clients` table now exposes the full base column set (including
 * `createdBy`, `deletedAt`, `externalIds`, `mergedIntoId`, `defaultContactId`,
 * `complianceBecameClientAt`, `complianceArchivedAt`) plus compliance prefix
 * columns. Most of those base columns are owned by directory's services or
 * by the platform — compliance's create payload only carries the fields the
 * compliance UI / API has historically supported. The narrow projection
 * below mirrors the old `compliance.clients` shape mapped onto the new
 * field names per the C-2 mapping table.
 */
export const CreateClientSchema = createInsertSchema(clients)
  .pick({
    name: true,
    legalName: true,
    email: true,
    phone: true,
    websiteDomain: true,
    taxId: true,
    industry: true,
    addressLine1: true,
    addressLine2: true,
    city: true,
    state: true,
    postalCode: true,
    addressCountryId: true,
    complianceAccountManagerId: true,
    complianceStatus: true,
    complianceOnboardedAt: true,
    complianceNotes: true,
  });

export const UpdateClientSchema = CreateClientSchema.partial();

/**
 * Body shape for POST /clients/:id/transition. The controller-side `fieldKey`
 * stays as `'status'` (UI-facing); the service translates this to the
 * underlying `complianceStatus` column when reading the entity. Keeps the
 * endpoint generic so additional workflow fields can be added later.
 */
export const TransitionClientSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;
export type TransitionClientDto = z.infer<typeof TransitionClientSchema>;
export type ClientRow = z.infer<typeof ClientRowSchema>;
