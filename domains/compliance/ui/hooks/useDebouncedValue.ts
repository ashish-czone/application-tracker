import { useEffect, useState } from 'react';

/**
 * Debounce a frequently-changing value (typically a search input). Returns
 * the latest value once `delayMs` has elapsed without further updates so
 * downstream queries don't fire on every keystroke. Default 300ms, the same
 * window the data-fetching rule recommends for server-side search.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
