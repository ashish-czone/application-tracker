/**
 * Coerce interpolated string values to match target field types.
 *
 * Mustache interpolation always produces strings, but entity validation
 * expects values in their canonical formats (e.g. YYYY-MM-DD for date,
 * number for currency). This function applies safe, predictable coercions
 * within the same type family.
 */
export function coerceFieldValues(
  values: Record<string, unknown>,
  fieldTypeMap: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    const fieldType = fieldTypeMap[key];
    if (!fieldType || typeof value !== 'string') {
      result[key] = value;
      continue;
    }

    result[key] = coerceValue(value, fieldType);
  }

  return result;
}

function coerceValue(value: string, fieldType: string): unknown {
  switch (fieldType) {
    case 'date':
      return extractDate(value);

    case 'datetime':
      return normalizeDateTime(value);

    case 'number':
    case 'currency':
    case 'decimal': {
      const num = Number(value);
      return Number.isNaN(num) ? value : num;
    }

    case 'boolean':
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;

    default:
      return value;
  }
}

/** Extract YYYY-MM-DD from various date/datetime string formats. */
function extractDate(value: string): string {
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // ISO datetime or Postgres format: extract date portion
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value;
}

/** Normalize datetime strings to ISO 8601. */
function normalizeDateTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;

  // Postgres format: "2026-04-06 10:00:00+00" → ISO
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}
