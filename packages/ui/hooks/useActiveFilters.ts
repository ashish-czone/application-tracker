import { useMemo } from 'react';
import type { DataGridFilter, DataGridFilterConfig } from '../components/data-grid/types';

export function useActiveFilters(
  filters: DataGridFilterConfig[],
  getFilter: (key: string) => string | undefined,
): DataGridFilter[] {
  return useMemo(() => {
    const active: DataGridFilter[] = [];
    for (const filter of filters) {
      const value = getFilter(filter.key);
      if (value) {
        const option = filter.options.find((o) => o.value === value);
        active.push({
          key: filter.key,
          label: filter.label,
          value: option?.label ?? value,
        });
      }
    }
    return active;
  }, [filters, getFilter]);
}
