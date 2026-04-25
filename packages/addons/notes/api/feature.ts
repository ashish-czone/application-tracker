/**
 * Notes addon feature contract.
 *
 * Entity authors opt in by spreading `notesFeature()` into their
 * `defineEntity({ features: ... })`. The notes UI plugins read the same key
 * via `readNotesFeature()` to decide where the Notes tab + sidebar render.
 */

export const NOTES_FEATURE_KEY = 'notes';

export interface NotesFeatureConfig {
  /** Reserved for future per-entity options (e.g. moderation, mentions scope). */
}

export type NotesFeatureValue = NotesFeatureConfig & { enabled: true };

/** Writer — spread into `defineEntity({ features: { ...notesFeature() } })`. */
export function notesFeature(config: NotesFeatureConfig = {}): Record<string, NotesFeatureValue> {
  return { [NOTES_FEATURE_KEY]: { ...config, enabled: true } };
}

/** Reader — returns the addon's bag entry, or undefined if not enabled. */
export function readNotesFeature(features: Record<string, unknown> | undefined): NotesFeatureValue | undefined {
  const value = features?.[NOTES_FEATURE_KEY];
  if (!value || typeof value !== 'object') return undefined;
  return value as NotesFeatureValue;
}
