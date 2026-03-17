import { useSearchParams } from 'react-router';
import { useCallback } from 'react';

interface UseDataGridParamsOptions {
  defaultSort?: string;
  defaultOrder?: 'asc' | 'desc';
  defaultPageSize?: number;
}

export function useDataGridParams(options: UseDataGridParamsOptions = {}) {
  const { defaultSort = '', defaultOrder = 'desc', defaultPageSize = 25 } = options;
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
    getFilter,
    setFilter,
    clearFilters,
  };
}
