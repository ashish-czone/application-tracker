import { z } from 'zod';

// RHF submits empty inputs as '' — coerce to undefined so "was it set?"
// checks don't treat blanks as intent to fill in an address.
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

function optionalString() {
  return z.preprocess(blankToUndefined, z.string().trim().optional().nullable());
}

function optionalUuid() {
  return z.preprocess(blankToUndefined, z.string().uuid().optional().nullable());
}

/**
 * Zod schema for a single address value. All fields are individually optional,
 * but if any field is set (so the user has started filling in an address),
 * `city` and `country_id` become required. Empty strings are treated as unset.
 */
export function addressZodSchema() {
  return z
    .object({
      address_line1: optionalString(),
      address_line2: optionalString(),
      city: optionalString(),
      state: optionalString(),
      postal_code: optionalString(),
      country_id: optionalUuid(),
    })
    .superRefine((val, ctx) => {
      const anySet = Object.values(val).some((v) => v !== undefined && v !== null && v !== '');
      if (!anySet) return;
      if (!val.city) {
        ctx.addIssue({ code: 'custom', message: 'City is required', path: ['city'] });
      }
      if (!val.country_id) {
        ctx.addIssue({ code: 'custom', message: 'Country is required', path: ['country_id'] });
      }
    });
}
