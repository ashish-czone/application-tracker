import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceClientRegistrations } from './client-registrations.schema';

export const ClientRegistrationRowSchema = createSelectSchema(complianceClientRegistrations);

// drizzle-zod infers `z.date()` for timestamptz columns, which can't be hit
// over JSON. Override the writable timestamp columns so callers can POST ISO
// 8601 strings (or already-parsed Date objects); coerce.date() accepts both
// and rejects anything that doesn't parse to a valid Date.
//
// Both `registeredAt` (`notNull().defaultNow()`) and `deactivatedAt`
// (nullable) are optional on insert — preserve that or the override turns
// what should be optional fields into required ones.
//
// `effectiveFrom` is a calendar DATE (YYYY-MM-DD string per data-formatting
// rules); narrow with a regex so we reject malformed values at the boundary.
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveFrom must be YYYY-MM-DD');

export const CreateClientRegistrationSchema = createInsertSchema(complianceClientRegistrations, {
  registeredAt: z.coerce.date().optional(),
  deactivatedAt: z.coerce.date().nullable().optional(),
  registrationNumber: z.string().min(1).max(100).nullable().optional(),
  effectiveFrom: calendarDate.nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateClientRegistrationSchema = CreateClientRegistrationSchema.partial();

// ---- List query schema ----------------------------------------------------
// Pure URL parsing + type coercion. Domain semantics (filter/sort field
// allowlisting, search column projection) live in the service. Page/limit
// stay undefined when missing so the service applies its own defaults;
// includeDeleted is only true on string "true".
//
// `clientId`, `lawId`, `search`, `sort`, `order` are surfaced explicitly so
// the service receives strongly-typed values instead of fishing them out
// of the passthrough soup. Other engine pass-through fields still flow
// via `.passthrough()` for forward-compat with admin tooling.

const optionalNumber = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
});

const booleanFromString = z.unknown().transform((raw) => raw === 'true' || raw === true);

const optionalString = z
  .unknown()
  .transform((raw) => (typeof raw === 'string' && raw.length > 0 ? raw : undefined));

export const RegistrationsListQuerySchema = z
  .object({
    page: optionalNumber,
    limit: optionalNumber,
    includeDeleted: booleanFromString,
    /** Filter to a single client. */
    clientId: optionalString,
    /** Filter to a single law (optional, used by admin tools). */
    lawId: optionalString,
    /** Free-text search; matches `registrationNumber` (case-insensitive). */
    search: optionalString,
    /** `<field>` or `<field>:asc|desc`. Service validates the field. */
    sort: optionalString,
    /** Pre-`sort:dir` legacy split — accepted for back-compat with engine callers. */
    order: optionalString,
  })
  .passthrough();

export type CreateClientRegistrationDto = z.infer<typeof CreateClientRegistrationSchema>;
export type UpdateClientRegistrationDto = z.infer<typeof UpdateClientRegistrationSchema>;
export type ClientRegistrationRow = z.infer<typeof ClientRegistrationRowSchema>;
export type RegistrationsListQuery = z.infer<typeof RegistrationsListQuerySchema>;
