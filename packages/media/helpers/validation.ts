import { randomUUID } from 'crypto';
import { extname } from 'path';

/**
 * Check if a mime type matches any pattern in the accept list.
 * Supports exact matches ("image/png") and wildcard patterns ("image/*").
 */
export function isMimeTypeAccepted(mimeType: string, accept: string[]): boolean {
  if (accept.length === 0) return true;

  return accept.some((pattern) => {
    if (pattern === '*' || pattern === '*/*') return true;
    if (pattern === mimeType) return true;

    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return mimeType.startsWith(prefix + '/');
    }

    return false;
  });
}

/**
 * Validate file size against a maximum.
 */
export function isFileSizeValid(size: number, maxSize: number): boolean {
  return size > 0 && size <= maxSize;
}

/**
 * Get file extension from original filename (includes dot).
 */
export function getExtension(originalName: string): string {
  return extname(originalName).toLowerCase();
}

/**
 * Generate a storage key: {entityType}/{entityId}/{fieldName}/{uuid}{ext}
 */
export function generateStorageKey(
  entityType: string,
  entityId: string,
  fieldName: string,
  originalName: string,
): string {
  const ext = getExtension(originalName);
  const uuid = randomUUID();
  return `${entityType}/${entityId}/${fieldName}/${uuid}${ext}`;
}

/**
 * Generate a temporary storage key: tmp/{uuid}{ext}
 * Files in tmp/ are auto-cleaned after 24 hours.
 */
export function generateTmpKey(originalName: string): string {
  const ext = getExtension(originalName);
  const uuid = randomUUID();
  return `tmp/${uuid}${ext}`;
}
