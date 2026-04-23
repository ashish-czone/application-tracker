import { BUILT_IN_SCOPE_TYPES, type ScopeSpec } from './types';

const customTypes = new Set<string>();

export function registerCustomScopeType(type: string): void {
  if ((BUILT_IN_SCOPE_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Scope type '${type}' is built-in and cannot be re-registered`);
  }
  customTypes.add(type);
}

export function isKnownScopeType(type: string): boolean {
  return (BUILT_IN_SCOPE_TYPES as readonly string[]).includes(type) || customTypes.has(type);
}

export function listCustomScopeTypes(): string[] {
  return Array.from(customTypes);
}

/**
 * Normalise an array of scopes:
 * - de-duplicates by type (later entries win for params)
 * - collapses to `[{type:'any'}]` if any scope is `any`
 * - preserves insertion order otherwise
 */
export function normaliseScopes(scopes: ScopeSpec[]): ScopeSpec[] {
  if (scopes.some((s) => s.type === 'any')) return [{ type: 'any' }];
  const byType = new Map<string, ScopeSpec>();
  for (const s of scopes) byType.set(s.type, s);
  return Array.from(byType.values());
}
