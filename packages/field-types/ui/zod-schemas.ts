import { z } from 'zod';
import type { ZodSchemaContext } from './types';

type ZodSchemaFn = (ctx: ZodSchemaContext) => z.ZodTypeAny;

/** String with optional maxLength */
export const stringSchema: ZodSchemaFn = (ctx) => {
  let s = z.string();
  if (ctx.maxLength) s = s.max(ctx.maxLength);
  return s;
};

/** Email with optional maxLength */
export const emailSchema: ZodSchemaFn = (ctx) => {
  let s = z.string().email('Invalid email address');
  if (ctx.maxLength) s = s.max(ctx.maxLength);
  return s;
};

/** URL with optional maxLength */
export const urlSchema: ZodSchemaFn = (ctx) => {
  let s = z.string().url('Must be a valid URL');
  if (ctx.maxLength) s = s.max(ctx.maxLength);
  return s;
};

/** Integer (coerced) */
export const integerSchema: ZodSchemaFn = () => z.coerce.number().int('Must be a whole number');

/** Decimal (coerced) */
export const decimalSchema: ZodSchemaFn = () => z.coerce.number();

/** Date string YYYY-MM-DD */
export const dateSchema: ZodSchemaFn = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

/** Datetime string */
export const datetimeSchema: ZodSchemaFn = () => z.string().min(1, 'Required');

/** Boolean */
export const booleanSchema: ZodSchemaFn = () => z.boolean();

/** UUID string (for lookup/user/category) */
export const uuidSchema: ZodSchemaFn = () => z.string();

/** Array of strings (for multi_select/tags/multi_user/multi_lookup) */
export const arraySchema: ZodSchemaFn = () => z.array(z.string());

/** Any value (for file) */
export const anySchema: ZodSchemaFn = () => z.any();

/** No-op schema (for auto_number — shouldn't be in forms) */
export const noopSchema: ZodSchemaFn = () => z.any();
