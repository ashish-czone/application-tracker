import type { FieldDefinition } from '@packages/eav-attributes-ui';
import type { FieldUI } from '../types';

/**
 * Pre-submit hook for hand-written entities whose pickers show one identity
 * but the form must persist a different FK value. For each editable field
 * with a configured `FieldUI.lookupResolveValue`, the picked option is
 * passed through the resolver and the form payload is rewritten to carry
 * the resolved value.
 *
 * Generic primitive — used by clients (companies picker → recruit_clients.id
 * via findOrCreateForCompany) and by any future entity with the same shape.
 */
export async function resolveLookupValues(
  data: Record<string, unknown>,
  editableFields: FieldDefinition[],
  apiFn: {
    get: <T>(url: string) => Promise<T>;
    post: <T>(url: string, body?: unknown) => Promise<T>;
  },
  getFieldUI: (entityType: string, fieldKey: string) => FieldUI | undefined,
  entityType: string,
): Promise<Record<string, unknown>> {
  const next = { ...data };
  for (const field of editableFields) {
    const resolver = getFieldUI(entityType, field.fieldKey)?.lookupResolveValue;
    if (!resolver) continue;
    const raw = next[field.fieldKey];
    if (raw == null || raw === '') continue;
    const picked = { label: '', value: String(raw) };
    const resolved = await resolver(apiFn, picked);
    next[field.fieldKey] = resolved.value;
  }
  return next;
}
