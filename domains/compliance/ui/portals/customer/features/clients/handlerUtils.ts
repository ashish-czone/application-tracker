import type { User } from '@packages/users-ui';

/**
 * Renders a user's display name from first + last, falling back to whichever
 * piece is present, then to the email's local part. Mirrors the format
 * elsewhere in the platform — keeps handler labels consistent across screens.
 */
export function formatUserDisplayName(user: Pick<User, 'firstName' | 'lastName' | 'email'>): string {
  const first = (user.firstName ?? '').trim();
  const last = (user.lastName ?? '').trim();
  const full = [first, last].filter(Boolean).join(' ');
  if (full) return full;
  if (user.email) return user.email.split('@')[0];
  return 'Unknown user';
}

/**
 * Two-letter initials for an avatar badge. Uses first + last where both are
 * present, otherwise the first two letters of whatever non-empty piece is
 * available.
 */
export function formatUserInitials(user: Pick<User, 'firstName' | 'lastName' | 'email'>): string {
  const first = (user.firstName ?? '').trim();
  const last = (user.lastName ?? '').trim();
  if (first && last) return (first[0] + last[0]).toUpperCase();
  const fallback = first || last || (user.email ?? '').split('@')[0];
  return fallback.slice(0, 2).toUpperCase() || '—';
}

/**
 * Picks the most useful subtitle for a handler row: the user's first
 * org-unit position name (e.g. "Senior · GST Desk"), or empty string when
 * the user has no positions attached.
 */
export function formatUserPositionLabel(user: Pick<User, 'positions'>): string {
  const first = user.positions?.[0];
  if (!first) return '';
  if (first.positionName && first.unitName) {
    return `${first.positionName} · ${first.unitName}`;
  }
  return first.positionName || first.unitName || '';
}
