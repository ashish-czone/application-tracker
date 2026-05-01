import type { CellRenderer } from './types';

/**
 * Default cell renderer. Coerces the value to a string and renders it in a
 * truncating span. Null/undefined renders the em-dash placeholder used
 * across the platform's data-grid cells.
 */
export const TextCell: CellRenderer = ({ value }) => {
  if (value == null || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === 'object') {
    // Non-string values that aren't dates: stringify defensively. Dates use
    // `formatDate` upstream — by the time TextCell sees a Date, it's a bug
    // signal, not something to format.
    return <span className="truncate">{JSON.stringify(value)}</span>;
  }
  return <span className="truncate">{String(value)}</span>;
};
