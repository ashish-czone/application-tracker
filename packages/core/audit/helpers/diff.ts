export interface FieldDiff {
  from: unknown;
  to: unknown;
}

/**
 * Computes a shallow diff between two objects.
 * Returns null if there are no differences.
 */
export function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  excludeFields: string[] = [],
): Record<string, FieldDiff> | null {
  if (!before || !after) return null;

  const excludeSet = new Set(excludeFields);
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff: Record<string, FieldDiff> = {};

  for (const key of allKeys) {
    if (excludeSet.has(key)) continue;
    const oldVal = before[key];
    const newVal = after[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { from: oldVal, to: newVal };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * Infers audit action from event name.
 * 'tasks.TaskCreated' -> 'created'
 * 'tasks.TaskUpdated' -> 'updated'
 * 'tasks.TaskDeleted' -> 'deleted'
 */
export function inferAction(eventName: string): string {
  const lower = eventName.toLowerCase();
  if (lower.endsWith('created')) return 'created';
  if (lower.endsWith('updated')) return 'updated';
  if (lower.endsWith('deleted')) return 'deleted';
  if (lower.endsWith('registered')) return 'registered';

  const parts = eventName.split('.');
  if (parts.length >= 2) {
    return parts[parts.length - 1]
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
  return eventName;
}

/**
 * Strips sensitive fields from a snapshot object.
 */
export function redactSensitiveFields(
  snapshot: Record<string, unknown> | null | undefined,
  sensitiveFields: string[],
): Record<string, unknown> | null {
  if (!snapshot) return null;
  if (sensitiveFields.length === 0) return snapshot;

  const result = { ...snapshot };
  for (const field of sensitiveFields) {
    delete result[field];
  }
  return result;
}
