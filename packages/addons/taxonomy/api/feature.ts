/**
 * Tags addon feature contract — opt-in inline tagging on the entity detail
 * header. Distinct from the `tags` field type, which lets users tag records
 * via a regular form field.
 */

export const TAGS_FEATURE_KEY = 'tags';

export interface TagsFeatureConfig {
  /** Tag group slug to render in the entity detail header. */
  groupSlug: string;
}

export type TagsFeatureValue = TagsFeatureConfig & { enabled: true };

export function tagsFeature(config: TagsFeatureConfig): Record<string, TagsFeatureValue> {
  return { [TAGS_FEATURE_KEY]: { ...config, enabled: true } };
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
