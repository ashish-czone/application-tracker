import type { AddressDisplayProps } from './AddressListCell';

/**
 * Multi-line address block, formatted postal-style. Used in detail views.
 */
export function AddressDetailView({ value, countryLabel, className }: AddressDisplayProps) {
  if (!value) return <span className="text-sm text-muted-foreground">—</span>;

  const cityStatePostal = [value.city, value.state, value.postal_code].filter(Boolean).join(', ');

  const lines = [value.address_line1, value.address_line2, cityStatePostal, countryLabel].filter(
    (line) => line && String(line).trim() !== '',
  );

  if (lines.length === 0) return <span className="text-sm text-muted-foreground">—</span>;

  return (
    <div className={className ?? 'text-sm text-foreground space-y-0.5'}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}
