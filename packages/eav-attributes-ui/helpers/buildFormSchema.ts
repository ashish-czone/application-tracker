import { z } from 'zod';
import type { FieldDefinition } from '../types';

/**
 * Build a Zod schema dynamically from field definitions.
 * Used for client-side form validation — the server is the source of truth.
 */
export function buildFormSchema(fields: FieldDefinition[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    // Skip non-editable and relational types handled by separate UI
    if (field.fieldType === 'auto_number' || field.isReadonly) continue;
    if (field.fieldType === 'tags' || field.fieldType === 'file') continue;

    let fieldSchema: z.ZodTypeAny;

    switch (field.fieldType) {
      case 'text':
      case 'phone':
      case 'textarea': {
        let s = z.string();
        if (field.maxLength) s = s.max(field.maxLength);
        fieldSchema = s;
        break;
      }

      case 'email': {
        let s = z.string().email('Invalid email address');
        if (field.maxLength) s = s.max(field.maxLength);
        fieldSchema = s;
        break;
      }

      case 'url': {
        let s = z.string().url('Must be a valid URL');
        if (field.maxLength) s = s.max(field.maxLength);
        fieldSchema = s;
        break;
      }

      case 'number':
      case 'currency':
        fieldSchema = z.coerce.number().int('Must be a whole number');
        break;

      case 'decimal':
        fieldSchema = z.coerce.number();
        break;

      case 'date':
        fieldSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');
        break;

      case 'datetime':
        fieldSchema = z.string().min(1, 'Required');
        break;

      case 'boolean':
        fieldSchema = z.boolean();
        break;

      case 'picklist':
        fieldSchema = z.string();
        break;

      case 'multi_select':
        fieldSchema = z.array(z.string());
        break;

      case 'lookup':
      case 'user':
      case 'category':
        fieldSchema = z.string();
        break;

      default:
        fieldSchema = z.string();
    }

    // Make optional if not required
    if (!field.isRequired) {
      if (field.fieldType === 'boolean') {
        fieldSchema = fieldSchema.optional();
      } else if (field.fieldType === 'multi_select') {
        fieldSchema = fieldSchema.optional();
      } else {
        // Allow empty string + coerce to undefined for optional string/number fields
        fieldSchema = z.union([fieldSchema, z.literal('')]).optional();
      }
    }

    shape[field.fieldKey] = fieldSchema;
  }

  return z.object(shape);
}
