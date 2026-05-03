import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { useDebounce } from '@packages/ui';

export interface TypeaheadInlinePickerOption {
  value: string;
  label: string;
}

interface TypeaheadInlinePickerProps<T extends TypeaheadInlinePickerOption> {
  /** Field label shown above the trigger. */
  label: string;
  /** Currently selected option (drives trigger render). */
  selected: T;
  /** Async option source. Receives the debounced search string and returns options. */
  options: T[];
  isLoading?: boolean;
  /** Called when the search input changes (already debounced). */
  onSearchChange: (search: string) => void;
  /** Called with the picked option (full record, not just id) when a user clicks one. */
  onPick: (option: T) => void;
  /** Renders the trigger value. */
  renderValue: (selected: T) => React.ReactNode;
  /** Renders each option row. */
  renderOption: (option: T, isSelected: boolean) => React.ReactNode;
  /** Search input placeholder. */
  searchPlaceholder?: string;
  /** Empty-state copy (no results for current search). */
  emptyLabel?: string;
}

/**
 * Inline-edit picker with a server-driven typeahead. Same trigger style as
 * the static `InlineDropdown` in FilingDetailDrawer — dashed underline button —
 * but the popup carries a search input and scrollable async options.
 *
 * Domain-local: only consumer is the Handler cell in FilingDetailDrawer.
 * Lift to packages/ui if a second consumer appears.
 */
export function TypeaheadInlinePicker<T extends TypeaheadInlinePickerOption>({
  label,
  selected,
  options,
  isLoading,
  onSearchChange,
  onPick,
  renderValue,
  renderOption,
  searchPlaceholder = 'Search…',
  emptyLabel = 'No matches',
}: TypeaheadInlinePickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useEffect(() => {
    onSearchChange(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    inputRef.current?.focus();
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, updatePos]);

  // Reset search on close so the next open starts empty.
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  return (
    <div>
      <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
        {label}
      </div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 group -ml-1.5 pl-1.5 pr-1 py-0.5 border-b border-dashed border-rule hover:border-rule hover:bg-paper-sunken transition-colors"
      >
        {renderValue(selected)}
        <ChevronDown className="w-3 h-3 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[260px] bg-paper-raised border border-rule shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-rule">
            <Search className="w-3 h-3 text-ink-muted flex-none" strokeWidth={1.5} />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent outline-none text-sm font-sans text-ink placeholder:text-ink-muted"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {isLoading && options.length === 0 ? (
              <div className="px-3 py-2 text-[11px] font-sans text-ink-muted">Loading…</div>
            ) : options.length === 0 ? (
              <div className="px-3 py-2 text-[11px] font-sans text-ink-muted">{emptyLabel}</div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === selected.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onPick(opt);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm font-sans transition-colors ${
                      isSelected ? 'bg-paper-sunken/60 text-ink' : 'text-ink hover:bg-paper-sunken/40'
                    }`}
                  >
                    {renderOption(opt, isSelected)}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
