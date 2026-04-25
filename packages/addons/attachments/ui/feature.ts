/**
 * Client-side reader for the attachments addon feature key. Mirrors the
 * server-side `@packages/attachments/feature` shape.
 */

export const ATTACHMENTS_FEATURE_KEY = 'attachments';

export interface AttachmentsFeatureValue {
  enabled: true;
  maxFileSize?: number;
  acceptedMimeTypes?: string[];
  deleteMode?: 'soft' | 'hard';
}

export function readAttachmentsFeature(
  features: Record<string, unknown> | undefined,
): AttachmentsFeatureValue | undefined {
  const value = features?.[ATTACHMENTS_FEATURE_KEY];
  if (!value || typeof value !== 'object') return undefined;
  return value as AttachmentsFeatureValue;
}
