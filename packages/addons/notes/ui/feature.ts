/**
 * Client-side reader for the notes addon feature key. Mirrors the server-side
 * `@packages/notes/feature` shape — kept in sync intentionally so the UI
 * doesn't depend on the API package.
 */

export const NOTES_FEATURE_KEY = 'notes';

export interface NotesFeatureValue {
  enabled: true;
}

export function readNotesFeature(features: Record<string, unknown> | undefined): NotesFeatureValue | undefined {
  const value = features?.[NOTES_FEATURE_KEY];
  if (!value || typeof value !== 'object') return undefined;
  return value as NotesFeatureValue;
}
