/**
 * Shared display formatting utilities.
 * Use these throughout the frontend to ensure consistent formatting.
 */

/**
 * Convert a kebab-case or snake_case string to Title Case.
 * "phone-screen" → "Phone Screen", "in_progress" → "In Progress"
 */
export function formatLabel(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format an ISO date string as a short date: "Apr 7, 2026".
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format an ISO datetime string as date + time without seconds: "Apr 7, 2026, 2:30 PM".
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format an ISO date string as a short date without year: "Apr 7".
 */
export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a currency amount stored as integer cents for display.
 * Returns "—" for null/undefined/0. Otherwise "$1,250.50".
 */
export function formatCurrency(cents: number | null | undefined, currencyCode = 'USD'): string {
  if (cents == null || cents === 0) return '—';
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
