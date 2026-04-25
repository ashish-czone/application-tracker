/**
 * Client-side reader for the tags addon feature key.
 */

export const TAGS_FEATURE_KEY = 'tags';

export interface TagsFeatureValue {
  enabled: true;
  groupSlug: string;
}

export function readTagsFeature(
  features: Record<string, unknown> | undefined,
): TagsFeatureValue | undefined {
  const value = features?.[TAGS_FEATURE_KEY];
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Partial<TagsFeatureValue>;
  if (typeof v.groupSlug !== 'string') return undefined;
  return value as TagsFeatureValue;
}
