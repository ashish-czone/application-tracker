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

// ---- List query schema ---------------------------------------------------
// Validates the URL params the client-contacts list endpoint understands,
// then passes everything else through verbatim so the service-layer
// `buildListQuery` helper can pick up structured `filters`, bare-id
// passthroughs (`?complianceClientId=…`), `search`, `sort`, and `order`.
// Page/limit stay undefined when missing (helper supplies defaults);
// includeDeleted only true on string "true".

const optionalNumber = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
});

const booleanFromString = z.unknown().transform((raw) => raw === 'true' || raw === true);

const optionalSortString = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalOrder = z
  .union([z.literal('asc'), z.literal('desc')])
  .optional();

const optionalSearchString = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalFiltersString = z
  .string()
  .optional()
  .transform((s) => (s && s.length > 0 ? s : undefined));

export const ClientContactsListQuerySchema = z
  .object({
    page: optionalNumber,
    limit: optionalNumber,
    includeDeleted: booleanFromString,
    search: optionalSearchString,
    sort: optionalSortString,
    order: optionalOrder,
    filters: optionalFiltersString,
  })
  .passthrough()
  .transform((raw) => {
    // Support `sort=field:dir` shorthand the way compliance-filings
    // does — the frontend's TanStack table click maps to this shape.
    let sort = raw.sort;
    let order = raw.order;
    if (typeof raw.sort === 'string' && raw.sort.includes(':')) {
      const [field, dir] = raw.sort.split(':');
      sort = field || undefined;
      order = dir === 'asc' ? 'asc' : 'desc';
    }
    return { ...raw, sort, order };
  });

export type CreateClientContactDto = z.infer<typeof CreateClientContactSchema>;
export type UpdateClientContactDto = z.infer<typeof UpdateClientContactSchema>;
export type ClientContactRow = z.infer<typeof ClientContactRowSchema>;
export type ClientContactsListQuery = z.infer<typeof ClientContactsListQuerySchema>;
