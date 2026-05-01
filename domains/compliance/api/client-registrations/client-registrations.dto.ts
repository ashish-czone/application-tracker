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
// Replaces the controller's inline page/limit/includeDeleted coercion. Same
// behaviour preserved: page/limit stay undefined when missing (engine
// supplies defaults), includeDeleted only true on string "true". Engine
// pass-through fields (clientId, lawId, sort, order, etc.) flow through
// via `.passthrough()`.

const optionalNumber = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
});

const booleanFromString = z.unknown().transform((raw) => raw === 'true' || raw === true);

export const RegistrationsListQuerySchema = z
  .object({
    page: optionalNumber,
    limit: optionalNumber,
    includeDeleted: booleanFromString,
  })
  .passthrough();

export type CreateClientRegistrationDto = z.infer<typeof CreateClientRegistrationSchema>;
export type UpdateClientRegistrationDto = z.infer<typeof UpdateClientRegistrationSchema>;
export type ClientRegistrationRow = z.infer<typeof ClientRegistrationRowSchema>;
export type RegistrationsListQuery = z.infer<typeof RegistrationsListQuerySchema>;
