import type { FieldDefinition, PicklistOption, FullLayoutField } from '../types';

export interface ValidationError {
  field: string;
  message: string;
  code: 'required' | 'type' | 'maxLength' | 'format' | 'picklist' | 'readonly' | 'unknown' | 'auto_number';
}

export interface ValidationOptions {
  /** When true, required fields not present in payload are skipped (for partial updates) */
  partial?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** A field definition with its picklist options attached */
export type FieldDefinitionWithOptions = FieldDefinition & { picklistOptions: PicklistOption[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a flat entity payload against field definitions.
 * Pure synchronous function — async checks (uniqueness) remain in the entity service.
 */
export function validatePayload(
  definitions: FieldDefinitionWithOptions[],
  payload: Record<string, unknown>,
  options?: ValidationOptions,
): ValidationResult {
  const errors: ValidationError[] = [];
  const defMap = new Map(definitions.map(d => [d.fieldKey, d]));
  const partial = options?.partial ?? false;

  // Check for unknown keys in payload
  for (const key of Object.keys(payload)) {
    if (!defMap.has(key)) {
      errors.push({ field: key, message: `Unknown field '${key}'`, code: 'unknown' });
    }
  }

  for (const def of definitions) {
    const value = payload[def.fieldKey];
    const present = def.fieldKey in payload;

    // Auto-number fields cannot be set by user
    if (def.fieldType === 'auto_number' && present) {
      errors.push({ field: def.fieldKey, message: 'Auto-number fields cannot be set manually', code: 'auto_number' });
      continue;
    }

    // Readonly fields cannot be set on update
    if (def.isReadonly && present && partial) {
      errors.push({ field: def.fieldKey, message: `Field '${def.label}' is read-only`, code: 'readonly' });
      continue;
    }

    // Required check (skip in partial mode if field not present)
    if (def.isRequired && !partial) {
      if (!present || value === null || value === undefined || value === '') {
        errors.push({ field: def.fieldKey, message: `${def.label} is required`, code: 'required' });
        continue;
      }
    }

    // Skip validation if value not present or null (optional field)
    if (!present || value === null || value === undefined || value === '') {
      continue;
    }

    // Type and format validation
    const fieldError = validateFieldValue(def, value);
    if (fieldError) {
      errors.push({ field: def.fieldKey, ...fieldError });
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateFieldValue(
  def: FieldDefinitionWithOptions,
  value: unknown,
): { message: string; code: ValidationError['code'] } | null {
  switch (def.fieldType) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') return { message: `${def.label} must be a string`, code: 'type' };
      if (def.maxLength && value.length > def.maxLength) {
        return { message: `${def.label} must be at most ${def.maxLength} characters`, code: 'maxLength' };
      }
      return null;
    }

    case 'email': {
      if (typeof value !== 'string') return { message: `${def.label} must be a string`, code: 'type' };
      if (!EMAIL_RE.test(value)) return { message: `${def.label} must be a valid email address`, code: 'format' };
      if (def.maxLength && value.length > def.maxLength) {
        return { message: `${def.label} must be at most ${def.maxLength} characters`, code: 'maxLength' };
      }
      return null;
    }

    case 'phone': {
      if (typeof value !== 'string') return { message: `${def.label} must be a string`, code: 'type' };
      if (def.maxLength && value.length > def.maxLength) {
        return { message: `${def.label} must be at most ${def.maxLength} characters`, code: 'maxLength' };
      }
      return null;
    }

    case 'url': {
      if (typeof value !== 'string') return { message: `${def.label} must be a string`, code: 'type' };
      if (!/^https?:\/\//i.test(value)) {
        return { message: `${def.label} must start with http:// or https://`, code: 'format' };
      }
      if (def.maxLength && value.length > def.maxLength) {
        return { message: `${def.label} must be at most ${def.maxLength} characters`, code: 'maxLength' };
      }
      return null;
    }

    case 'number':
    case 'currency': {
      const num = Number(value);
      if (typeof value !== 'number' && (typeof value !== 'string' || isNaN(num))) {
        return { message: `${def.label} must be a number`, code: 'type' };
      }
      if (!Number.isInteger(num)) return { message: `${def.label} must be an integer`, code: 'type' };
      return null;
    }

    case 'decimal': {
      const num = Number(value);
      if (typeof value !== 'number' && (typeof value !== 'string' || isNaN(num))) {
        return { message: `${def.label} must be a number`, code: 'type' };
      }
      return null;
    }

    case 'date': {
      if (typeof value !== 'string') return { message: `${def.label} must be a string`, code: 'type' };
      if (!DATE_RE.test(value)) return { message: `${def.label} must be in YYYY-MM-DD format`, code: 'format' };
      return null;
    }

    case 'datetime': {
      if (typeof value !== 'string') return { message: `${def.label} must be a string`, code: 'type' };
      if (isNaN(Date.parse(value))) return { message: `${def.label} must be a valid ISO date-time`, code: 'format' };
      return null;
    }

    case 'boolean': {
      if (typeof value !== 'boolean') return { message: `${def.label} must be true or false`, code: 'type' };
      return null;
    }

    case 'picklist': {
      if (typeof value !== 'string') return { message: `${def.label} must be a string`, code: 'type' };
      const validValues = def.picklistOptions.map(o => o.value);
      if (validValues.length > 0 && !validValues.includes(value)) {
        return { message: `${def.label} must be one of: ${validValues.join(', ')}`, code: 'picklist' };
      }
      return null;
    }

    case 'multi_select': {
      if (!Array.isArray(value)) return { message: `${def.label} must be an array`, code: 'type' };
      const validValues = def.picklistOptions.map(o => o.value);
      if (validValues.length > 0) {
        for (const v of value) {
          if (typeof v !== 'string') return { message: `${def.label} values must be strings`, code: 'type' };
          if (!validValues.includes(v)) {
            return { message: `Invalid value '${v}' for ${def.label}`, code: 'picklist' };
          }
        }
      }
      return null;
    }

    case 'lookup':
    case 'user': {
      if (typeof value !== 'string') return { message: `${def.label} must be a string`, code: 'type' };
      if (!UUID_RE.test(value)) return { message: `${def.label} must be a valid UUID`, code: 'format' };
      return null;
    }

    case 'auto_number':
      // Already handled above
      return null;

    default:
      return null;
  }
}
