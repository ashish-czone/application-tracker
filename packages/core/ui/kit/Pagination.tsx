import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../lib/utils';

export interface PaginationProps {
  page: number;
  pageSize: number;
  pageCount: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');
  if (total > 1) pages.push(total);

  return pages;
}

/**
 * Instrument-themed pagination bar. Hairline top rule, small-caps labels,
 * JetBrains Mono tabular numerics, sharp-cornered page buttons. Sits below
 * a DataTable inside the same paper-raised surface.
 */
export function Pagination({
  page,
  pageSize,
  pageCount,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
}: PaginationProps) {
  const from = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRows);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-t border-rule px-3 py-2.5',
        className,
      )}
    >
      {/* Summary */}
      <span className="text-[11px] font-sans text-ink-muted">
        Showing{' '}
        <span className="font-mono tabular-nums text-ink">{from}</span>
        {' – '}
        <span className="font-mono tabular-nums text-ink">{to}</span>
        {' of '}
        <span className="font-mono tabular-nums text-ink">{totalRows}</span>
      </span>

      <div className="flex items-center gap-5">
        {/* Page size selector */}
        <label className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] font-sans font-medium text-ink-muted">
            Rows
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 w-14 border border-rule bg-transparent px-1.5 font-mono text-[11px] tabular-nums text-ink outline-none focus:border-ink transition-colors"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {/* Navigation */}
        <nav className="flex items-center gap-0.5" aria-label="Pagination">
          <PaginationButton
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            label="First page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          </PaginationButton>
          <PaginationButton
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          </PaginationButton>

          {getPageNumbers(page, pageCount).map((p, i) =>
            p === '...' ? (
              <span
                key={`ellipsis-${i}`}
                className="w-7 h-7 flex items-center justify-center font-mono text-[11px] text-ink-muted"
              >
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p as number)}
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 font-mono text-[11px] tabular-nums transition-colors',
                  p === page
                    ? 'bg-ink text-paper font-semibold'
                    : 'text-ink-soft hover:bg-paper-sunken/60 hover:text-ink',
                )}
              >
                {p}
              </button>
            ),
          )}

          <PaginationButton
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </PaginationButton>
          <PaginationButton
            onClick={() => onPageChange(pageCount)}
            disabled={page >= pageCount}
            label="Last page"
          >
            <ChevronsRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </PaginationButton>
        </nav>
      </div>
    </div>
  );
}

function PaginationButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 text-ink-muted transition-colors',
        'hover:text-ink hover:bg-paper-sunken/60',
        'disabled:opacity-30 disabled:pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}
