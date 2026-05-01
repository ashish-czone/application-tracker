import type { CellRenderer } from './types';

/**
 * Lookup cell. Reads the row's denormalised label column produced by the
 * server when the row is fetched with lookup hydration — convention is the
 * lookup field's value at `<field>` and its label at `<field>__label`.
 *
 * Example: column `field: 'lawId'`, lookup `{ entity: 'laws', labelField: 'name' }`
 * — server returns `lawId: 'uuid', lawId__label: 'Income Tax Act'`. The
 * cell renders the label.
 *
 * If no `__label` companion exists, falls back to the raw value (with a
 * subtle "id" treatment so reviewers spot un-hydrated lookups in the UI).
 */
export const LookupCell: CellRenderer = ({ value, row, column }) => {
  const labelKey = `${column.field}__label`;
  const label = row[labelKey];

  if (label == null || label === '') {
    if (value == null || value === '') {
      return <span className="text-muted-foreground">—</span>;
    }
    // Fallback: render raw id with monospace + muted treatment so it's
    // visually distinct from a hydrated label.
    return <span className="font-mono text-xs text-muted-foreground">{String(value)}</span>;
  }

  return <span className="truncate">{String(label)}</span>;
};
