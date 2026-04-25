/**
 * Attachments addon feature contract.
 *
 * Entity authors opt in by spreading `attachmentsFeature(...)` into their
 * `defineEntity({ features: ... })`. The attachments controller and the
 * detail-page UI both read the same key via `readAttachmentsFeature()`.
 */

export const ATTACHMENTS_FEATURE_KEY = 'attachments';

export interface AttachmentsFeatureConfig {
  /** Maximum file size in bytes. Default: 10 MB (from media module). */
  maxFileSize?: number;
  /** Accepted MIME types. Default: all. e.g. ['image/*', 'application/pdf'] */
  acceptedMimeTypes?: string[];
  /**
   * How individual attachments are deleted.
   * - 'soft' marks deletedAt
   * - 'hard' removes blob + row
   * Default: 'soft'.
   */
  deleteMode?: 'soft' | 'hard';
}

export type AttachmentsFeatureValue = AttachmentsFeatureConfig & { enabled: true };

/** Writer — spread into `defineEntity({ features: { ...attachmentsFeature() } })`. */
export function attachmentsFeature(
  config: AttachmentsFeatureConfig = {},
): Record<string, AttachmentsFeatureValue> {
  return { [ATTACHMENTS_FEATURE_KEY]: { ...config, enabled: true } };
}

/** Reader — returns the addon's bag entry, or undefined if not enabled. */
export function readAttachmentsFeature(
  features: Record<string, unknown> | undefined,
): AttachmentsFeatureValue | undefined {
  const value = features?.[ATTACHMENTS_FEATURE_KEY];
  if (!value || typeof value !== 'object') return undefined;
  return value as AttachmentsFeatureValue;
}
