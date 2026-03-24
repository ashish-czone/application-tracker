import { FormSelect } from '../form/FormSelect';
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
        <FormSelect
          key={filter.key}
          options={[
            { label: filter.placeholder ?? `All ${filter.label.toLowerCase()}`, value: '' },
            ...filter.options,
          ]}
          value={getFilter(filter.key) || ''}
          onChange={(val) => setFilter(filter.key, val || undefined)}
          placeholder={filter.placeholder ?? `All ${filter.label.toLowerCase()}`}
        />
      ))}
    </>
  );
}
