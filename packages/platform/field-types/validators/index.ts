import type { ValidateFn, FieldValidationError } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VError = FieldValidationError | null;

function checkString(value: unknown, label: string): VError {
  if (typeof value !== 'string') return { message: `${label} must be a string`, code: 'type' };
  return null;
}

function checkMaxLength(value: string, label: string, maxLength?: number | null): VError {
  if (maxLength && value.length > maxLength) {
    return { message: `${label} must be at most ${maxLength} characters`, code: 'maxLength' };
  }
  return null;
}

/** Validates: string + optional maxLength */
export const string: ValidateFn = (value, ctx) => {
  const err = checkString(value, ctx.label);
  if (err) return err;
  return checkMaxLength(value as string, ctx.label, ctx.maxLength);
};

/** Validates: string + email format + optional maxLength */
export const email: ValidateFn = (value, ctx) => {
  const err = checkString(value, ctx.label);
  if (err) return err;
  if (!EMAIL_RE.test(value as string)) return { message: `${ctx.label} must be a valid email address`, code: 'format' };
  return checkMaxLength(value as string, ctx.label, ctx.maxLength);
};

/**
 * Validates a plausible HTML-href value. Accepts:
 *   - absolute http/https URLs (`https://example.com/path`)
 *   - root-relative paths (`/about`, `/blog/post?x=1#top`)
 *   - fragment-only anchors (`#section`)
 *   - mailto: and tel: schemes
 *
 * Fields that need a stricter shape (OAuth redirects, webhook endpoints)
 * should layer their own check on top via entity-level hooks.
 */
const HREF_RE = /^(?:https?:\/\/\S+|\/\S*|#\S*|mailto:\S+|tel:\S+)$/i;
export const url: ValidateFn = (value, ctx) => {
  const err = checkString(value, ctx.label);
  if (err) return err;
  if (!HREF_RE.test(value as string)) {
    return {
      message: `${ctx.label} must be a URL (http/https), a path starting with /, an anchor starting with #, or a mailto:/tel: link`,
      code: 'format',
    };
  }
  return checkMaxLength(value as string, ctx.label, ctx.maxLength);
};

/** Validates: string + optional maxLength (same as string, used for phone) */
export const phone: ValidateFn = string;

/** Validates: number or numeric string, must be integer */
export const integer: ValidateFn = (value, ctx) => {
  const num = Number(value);
  if (typeof value !== 'number' && (typeof value !== 'string' || isNaN(num))) {
    return { message: `${ctx.label} must be a number`, code: 'type' };
  }
  if (!Number.isInteger(num)) return { message: `${ctx.label} must be an integer`, code: 'type' };
  return null;
};

/** Validates: number or numeric string (decimals allowed) */
export const decimal: ValidateFn = (value, ctx) => {
  const num = Number(value);
  if (typeof value !== 'number' && (typeof value !== 'string' || isNaN(num))) {
    return { message: `${ctx.label} must be a number`, code: 'type' };
  }
  return null;
};

/** Validates: string in YYYY-MM-DD format */
export const date: ValidateFn = (value, ctx) => {
  const err = checkString(value, ctx.label);
  if (err) return err;
  if (!DATE_RE.test(value as string)) return { message: `${ctx.label} must be in YYYY-MM-DD format`, code: 'format' };
  return null;
};

/**
 * Validates: a value that represents a moment in time — either a `Date`
 * instance or an ISO date-time string. Encoding-agnostic by design: the
 * platform sees Date instances on rows hydrated by drizzle (`mode: 'date'`,
 * the default for `timestamptz`) and ISO strings on rows arriving over JSON
 * or coerced through `z.coerce.date()`. Either is a valid datetime; the
 * validator's job is to assert the value parses, not to mandate a wire form.
 */
export const datetime: ValidateFn = (value, ctx) => {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return { message: `${ctx.label} must be a valid ISO date-time`, code: 'format' };
    return null;
  }
  const err = checkString(value, ctx.label);
  if (err) return err;
  if (isNaN(Date.parse(value as string))) return { message: `${ctx.label} must be a valid ISO date-time`, code: 'format' };
  return null;
};

/** Validates: strict boolean */
export const boolean: ValidateFn = (value, ctx) => {
  if (typeof value !== 'boolean') return { message: `${ctx.label} must be true or false`, code: 'type' };
  return null;
};

/** Validates: string matching UUID format */
export const uuid: ValidateFn = (value, ctx) => {
  const err = checkString(value, ctx.label);
  if (err) return err;
  if (!UUID_RE.test(value as string)) return { message: `${ctx.label} must be a valid UUID`, code: 'format' };
  return null;
};

/** Validates: array of UUID strings */
export const uuidArray: ValidateFn = (value, ctx) => {
  if (!Array.isArray(value)) return { message: `${ctx.label} must be an array of IDs`, code: 'type' };
  for (const v of value) {
    if (typeof v !== 'string') return { message: `${ctx.label} values must be strings`, code: 'type' };
    if (!UUID_RE.test(v)) return { message: `${ctx.label} values must be valid UUIDs`, code: 'format' };
  }
  return null;
};

/** Validates: string in picklist options (from ctx.picklistOptions) */
export const picklist: ValidateFn = (value, ctx) => {
  const err = checkString(value, ctx.label);
  if (err) return err;
  const validValues = ctx.picklistOptions?.map(o => o.value) ?? [];
  if (validValues.length > 0 && !validValues.includes(value as string)) {
    return { message: `${ctx.label} must be one of: ${validValues.join(', ')}`, code: 'picklist' };
  }
  return null;
};

/** Validates: array of strings, each in picklist options */
export const multiSelect: ValidateFn = (value, ctx) => {
  if (!Array.isArray(value)) return { message: `${ctx.label} must be an array`, code: 'type' };
  const validValues = ctx.picklistOptions?.map(o => o.value) ?? [];
  if (validValues.length > 0) {
    for (const v of value) {
      if (typeof v !== 'string') return { message: `${ctx.label} values must be strings`, code: 'type' };
      if (!validValues.includes(v)) {
        return { message: `Invalid value '${v}' for ${ctx.label}`, code: 'picklist' };
      }
    }
  }
  return null;
};

/** Always passes — for field types with no value validation (file, auto_number) */
export const noop: ValidateFn = () => null;
