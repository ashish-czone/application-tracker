import { useState, useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';

export interface ComboboxOption {
  label: string;
  value: string;
  color?: string;
  disabled?: boolean;
}

export interface UseComboboxStateArgs<T extends ComboboxOption = ComboboxOption> {
  /** Static options — filtered client-side on the search query. */
  options?: T[];
  /**
   * Async search callback. Called on every keystroke with a 300ms debounce.
   * Only used when `options` is not provided.
   */
  onSearch?: (query: string) => Promise<T[]>;
  /** Whether the popover/dropdown is currently open — resets search when closed. */
  isOpen: boolean;
  /** Optional filter applied to static options + async results (e.g. exclude already-selected). */
  filter?: (option: T) => boolean;
}

export interface UseComboboxStateResult<T extends ComboboxOption = ComboboxOption> {
  search: string;
  setSearch: (value: string) => void;
  isSearching: boolean;
  /** Options to render in the dropdown list. */
  displayOptions: T[];
  /** Debounced search query, for effects or displays. */
  debouncedSearch: string;
}

/**
 * Shared state engine for combobox-style selects.
 *
 * Both `Combobox` (single) and `MultiSelect` (multi) use this to avoid
 * duplicating async search, debounce, and client-side filter logic.
 */
export function useComboboxState<T extends ComboboxOption = ComboboxOption>(
  args: UseComboboxStateArgs<T>,
): UseComboboxStateResult<T> {
  const { options, onSearch, isOpen, filter } = args;
  const [search, setSearch] = useState('');
  const [asyncResults, setAsyncResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const lastQueryRef = useRef<string>('');

  // Reset search when closing
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setAsyncResults([]);
      setIsSearching(false);
    }
  }, [isOpen]);

  // Async search effect
  useEffect(() => {
    if (!onSearch || !isOpen) return;
    // Avoid firing for the same query twice
    if (lastQueryRef.current === debouncedSearch && asyncResults.length > 0) return;
    lastQueryRef.current = debouncedSearch;

    let cancelled = false;
    setIsSearching(true);
    onSearch(debouncedSearch)
      .then((results) => {
        if (cancelled) return;
        setAsyncResults(results);
        setIsSearching(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsSearching(false);
      });
    return () => {
      cancelled = true;
    };
    // asyncResults intentionally excluded — only re-run on query/open changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, onSearch, isOpen]);

  // Compute display options
  let displayOptions: T[];
  if (options) {
    const q = search.toLowerCase();
    displayOptions = options.filter(
      (opt) => !q || opt.label.toLowerCase().includes(q),
    );
  } else {
    displayOptions = asyncResults;
  }
  if (filter) {
    displayOptions = displayOptions.filter(filter);
  }

  return { search, setSearch, isSearching, displayOptions, debouncedSearch };
}
