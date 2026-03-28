import { useSearchParams } from 'react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FilterExpression, FilterOperator } from '../components/data-grid/filter-types';

interface UseDataGridParamsOptions {
  defaultSort?: string;
  defaultOrder?: 'asc' | 'desc';
  defaultPageSize?: number;
  /** localStorage key prefix for persisting filters (e.g., 'job-openings-list') */
  storageKey?: string;
}

export function useDataGridParams(options: UseDataGridParamsOptions = {}) {
  const { defaultSort = '', defaultOrder = 'desc', defaultPageSize = 25, storageKey } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('limit')) || defaultPageSize;
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || defaultSort;
  const order = (searchParams.get('order') as 'asc' | 'desc') || defaultOrder;

  const setPage = useCallback(
    (p: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (p <= 1) next.delete('page');
          else next.set('page', String(p));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPageSize = useCallback(
    (size: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('limit', String(size));
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSearch = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set('search', value);
          else next.delete('search');
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSort = useCallback(
    (column: string, direction: 'asc' | 'desc') => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('sort', column);
          next.set('order', direction);
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const getFilter = useCallback(
    (key: string): string | undefined => {
      return searchParams.get(key) || undefined;
    },
    [searchParams],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(
    (filterKeys: string[]) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          filterKeys.forEach((key) => next.delete(key));
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // ---------------------------------------------------------------------------
  // Structured filters — stored as JSON in ?filters= URL param
  // ---------------------------------------------------------------------------

  const VALID_OPERATORS = new Set<FilterOperator>([
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like',
    'in', 'notIn', 'isNull', 'isNotNull', 'between', 'contains',
  ]);

  const filtersStorageKey = storageKey ? `datagrid-filters-${storageKey}` : null;
  const lastRestoredKey = useRef<string | null>(null);

  const getFilters = useMemo((): FilterExpression[] => {
    const raw = searchParams.get('filters');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (f: any) => f && typeof f.field === 'string' && typeof f.operator === 'string' && VALID_OPERATORS.has(f.operator),
      );
    } catch {
      return [];
    }
  }, [searchParams]);

  // Restore filters from localStorage when navigating to a page (if no URL param exists)
  useEffect(() => {
    if (!filtersStorageKey || lastRestoredKey.current === filtersStorageKey) return;
    lastRestoredKey.current = filtersStorageKey;
    if (searchParams.get('filters')) return; // URL param takes precedence
    try {
      const stored = localStorage.getItem(filtersStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set('filters', stored);
              return next;
            },
            { replace: true },
          );
        }
      }
    } catch { /* ignore */ }
  }, [filtersStorageKey, searchParams, setSearchParams]);

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    if (!filtersStorageKey) return;
    const filters = getFilters;
    if (filters.length > 0) {
      localStorage.setItem(filtersStorageKey, JSON.stringify(filters));
    } else {
      localStorage.removeItem(filtersStorageKey);
    }
  }, [getFilters, filtersStorageKey]);

  const setFiltersParam = useCallback(
    (filters: FilterExpression[]) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (filters.length > 0) next.set('filters', JSON.stringify(filters));
          else next.delete('filters');
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const addFilter = useCallback(
    (expr: FilterExpression) => {
      const current = getFilters;
      const idx = current.findIndex((f) => f.field === expr.field);
      const updated = idx >= 0
        ? current.map((f, i) => (i === idx ? expr : f))
        : [...current, expr];
      setFiltersParam(updated);
    },
    [getFilters, setFiltersParam],
  );

  const removeFilter = useCallback(
    (field: string) => {
      setFiltersParam(getFilters.filter((f) => f.field !== field));
    },
    [getFilters, setFiltersParam],
  );

  const updateFilter = useCallback(
    (index: number, expr: FilterExpression) => {
      const updated = [...getFilters];
      if (index >= 0 && index < updated.length) {
        updated[index] = expr;
      }
      setFiltersParam(updated);
    },
    [getFilters, setFiltersParam],
  );

  const clearAllFilters = useCallback(() => {
    setFiltersParam([]);
  }, [setFiltersParam]);

  return {
    page,
    pageSize,
    search,
    sort,
    order,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    // Legacy filter methods (backward compat)
    getFilter,
    setFilter,
    clearFilters,
    // Structured filter methods
    filters: getFilters,
    addFilter,
    removeFilter,
    updateFilter,
    clearAllFilters,
    setFilters: setFiltersParam,
  };
}
