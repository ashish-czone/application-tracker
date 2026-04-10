import Mustache from 'mustache';

/**
 * Interpolate Mustache templates in a flat key-value object.
 * Used by the lifecycle engine to resolve dynamic values in
 * onSourceUpdated set operations.
 *
 * Example:
 *   interpolateValues({ dueDate: '{{payload.after.scheduledDate}}' }, context)
 *   → { dueDate: '2026-04-15' }
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
