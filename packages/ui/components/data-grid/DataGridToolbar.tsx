import { useState, useRef, useEffect } from 'react';
import { Search, X, Columns3 } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { cn } from '../../lib/utils';
import { Badge } from '../Badge';
import { useDebounce } from '../../hooks/useDebounce';
import type { DataGridFilter } from './types';

interface DataGridToolbarProps<TData> {
  table: Table<TData>;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  activeFilters?: DataGridFilter[];
  onFilterRemove?: (key: string) => void;
  onFiltersClear?: () => void;
  toolbarActions?: React.ReactNode;
}

export function DataGridToolbar<TData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  activeFilters = [],
  onFilterRemove,
  onFiltersClear,
  toolbarActions,
}: DataGridToolbarProps<TData>) {
  const [localSearch, setLocalSearch] = useState(search ?? '');
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(localSearch, 300);

  // Sync debounced search value to parent
  useEffect(() => {
    if (onSearchChange && debouncedSearch !== search) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange, search]);

  // Sync external search prop changes to local state (e.g., browser back/forward)
  useEffect(() => {
    if (search !== undefined && search !== localSearch) {
      setLocalSearch(search);
    }
    // Only react to external search changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Click outside to close column menu
  useEffect(() => {
    if (!columnMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [columnMenuOpen]);

  const hasFilters = activeFilters.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {/* Search */}
        {onSearchChange && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Column visibility toggle */}
        <div className="relative" ref={columnMenuRef}>
          <button
            type="button"
            onClick={() => setColumnMenuOpen(!columnMenuOpen)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors',
              columnMenuOpen && 'bg-accent text-accent-foreground',
            )}
          >
            <Columns3 className="h-4 w-4" />
            <span className="hidden sm:inline">Columns</span>
          </button>
          {columnMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
              {table
                .getAllLeafColumns()
                .filter((col) => col.getCanHide())
                .map((column) => (
                  <label
                    key={column.id}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      className="rounded border-input"
                    />
                    {typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id}
                  </label>
                ))}
            </div>
          )}
        </div>

        {/* Toolbar actions */}
        {toolbarActions}
      </div>

      {/* Filter chips */}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((filter) => (
            <Badge
              key={filter.key}
              variant="secondary"
              onRemove={onFilterRemove ? () => onFilterRemove(filter.key) : undefined}
            >
              {filter.label}: {filter.value}
            </Badge>
          ))}
          {onFiltersClear && activeFilters.length > 1 && (
            <button
              type="button"
              onClick={onFiltersClear}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
