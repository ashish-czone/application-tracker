import type { DataGridFilterConfig } from './types';

interface DataGridFiltersProps {
  filters: DataGridFilterConfig[];
  getFilter: (key: string) => string | undefined;
  setFilter: (key: string, value: string | undefined) => void;
}

export function DataGridFilters({ filters, getFilter, setFilter }: DataGridFiltersProps) {
  return (
    <>
      {filters.map((filter) => (
        <select
          key={filter.key}
          value={getFilter(filter.key) || ''}
          onChange={(e) => setFilter(filter.key, e.target.value || undefined)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">{filter.placeholder ?? `All ${filter.label.toLowerCase()}`}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </>
  );
}
