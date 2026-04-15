import { flexRender, type Table, type Header } from '@tanstack/react-table';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../Skeleton';

interface DataGridTableProps<TData> {
  table: Table<TData>;
  isLoading?: boolean;
  pageSize: number;
  onSortChange?: (column: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  rowClassName?: (row: TData) => string | undefined;
  rowAttributes?: (row: TData) => Record<string, string | undefined> | undefined;
}

function SortIcon({
  column,
  sortColumn,
  sortDirection,
}: {
  column: string;
  sortColumn?: string;
  sortDirection?: string;
}) {
  if (column !== sortColumn) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  }
  return sortDirection === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" />
  );
}

function isStickyRight(column: { columnDef: { meta?: unknown } }) {
  return (column.columnDef.meta as { sticky?: string } | undefined)?.sticky === 'right';
}

export function DataGridTable<TData>({
  table,
  isLoading,
  pageSize,
  onSortChange,
  sortColumn,
  sortDirection,
  rowClassName,
  rowAttributes,
}: DataGridTableProps<TData>) {
  const handleSort = (header: Header<TData, unknown>) => {
    if (!header.column.getCanSort() || !onSortChange) return;
    const columnId = header.column.id;
    const newDirection = columnId === sortColumn && sortDirection === 'asc' ? 'desc' : 'asc';
    onSortChange(columnId, newDirection);
  };

  return (
    <div data-slot="data-grid" className="rounded-md border overflow-x-auto">
      <table className="w-full min-w-max caption-bottom text-sm">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    'h-10 px-4 text-left align-middle font-medium text-muted-foreground',
                    header.column.getCanSort() &&
                      onSortChange &&
                      'cursor-pointer select-none hover:text-foreground transition-colors',
                    isStickyRight(header.column) &&
                      'sticky right-0 z-10 bg-muted/50 shadow-[−2px_0_4px_rgba(0,0,0,0.06)]',
                  )}
                  style={
                    header.getSize() !== 150 ? { width: header.getSize() } : undefined
                  }
                  onClick={() => handleSort(header)}
                >
                  {header.isPlaceholder ? null : (
                    <div className="flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && onSortChange && (
                        <SortIcon
                          column={header.column.id}
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                        />
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-background">
          {isLoading
            ? Array.from({ length: pageSize }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b last:border-0">
                  {table.getVisibleLeafColumns().map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        'h-12 px-4',
                        isStickyRight(column) && 'sticky right-0 z-10 bg-background',
                      )}
                    >
                      <Skeleton className="h-4 w-[60%]" />
                    </td>
                  ))}
                </tr>
              ))
            : table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'group/row border-b last:border-0 hover:bg-muted/50 transition-colors',
                    rowClassName?.(row.original),
                  )}
                  {...(rowAttributes?.(row.original) ?? {})}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'h-12 px-4 align-middle',
                        isStickyRight(cell.column) &&
                          'sticky right-0 z-10 bg-background group-hover/row:bg-muted/50',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
