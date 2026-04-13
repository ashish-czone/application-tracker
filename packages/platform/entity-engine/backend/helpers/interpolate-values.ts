import Mustache from 'mustache';

/**
 * Interpolate Mustache templates in a flat key-value object.
 * Used by entity action handlers to resolve dynamic values
 * from automation rule configurations.
 */
export function interpolateValues(
  values: Record<string, unknown>,
  context: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' && value.includes('{{')) {
      result[key] = Mustache.render(value, context);
    } else {
      result[key] = value;
    }
  }

  return result;
}
