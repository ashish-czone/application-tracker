import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SearchInputVariant = 'underline' | 'boxed' | 'bare';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Visual treatment of the wrapper.
   * - `underline` (default): hairline bottom rule with focus-within accent — filter bars, toolbars.
   * - `boxed`: full border with paper bed — sidebars, standalone panels.
   * - `bare`: no wrapper styling; compose inside an existing bordered header.
   */
  variant?: SearchInputVariant;
  /** Classes applied to the outer `<label>` wrapper. Use for layout (width, flex). */
  wrapperClassName?: string;
}

const wrapperStyles: Record<SearchInputVariant, string> = {
  underline:
    'flex items-center gap-2 border-b border-rule focus-within:border-ink transition-colors pb-1',
  boxed:
    'flex items-center gap-2 px-3 py-2 border border-rule bg-paper hover:border-ink-muted transition-colors',
  bare: 'flex items-center gap-2',
};

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ variant = 'underline', wrapperClassName, className, ...props }, ref) => (
    <label className={cn(wrapperStyles[variant], wrapperClassName)}>
      <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
      <input
        ref={ref}
        type="text"
        data-slot="search-input"
        className={cn(
          'w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans',
          className,
        )}
        {...props}
      />
    </label>
  ),
);
SearchInput.displayName = 'SearchInput';

export { SearchInput };
