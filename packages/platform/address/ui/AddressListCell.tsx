import type { AddressValue } from '@packages/address';

export interface AddressDisplayProps {
  value: AddressValue | null | undefined;
  /** Pre-resolved country display label (since value.country_id is a UUID). */
  countryLabel?: string | null;
  /** Class override for the wrapping element. */
  className?: string;
}

/**
 * Compact single-line address — `City, State, Country`. Used in data-grid cells
 * and other list contexts where vertical space is scarce.
 */
export function AddressListCell({ value, countryLabel, className }: AddressDisplayProps) {
  if (!value) return <span className="text-sm text-muted-foreground">—</span>;

  const parts = [value.city, value.state, countryLabel].filter(Boolean);
  if (parts.length === 0) return <span className="text-sm text-muted-foreground">—</span>;

  return <span className={className ?? 'text-sm text-foreground truncate'}>{parts.join(', ')}</span>;
}
