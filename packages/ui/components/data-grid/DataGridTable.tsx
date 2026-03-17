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

export function DataGridTable<TData>({
  table,
  isLoading,
  pageSize,
  onSortChange,
  sortColumn,
  sortDirection,
}: DataGridTableProps<TData>) {
  const handleSort = (header: Header<TData, unknown>) => {
    if (!header.column.getCanSort() || !onSortChange) return;
    const columnId = header.column.id;
    const newDirection = columnId === sortColumn && sortDirection === 'asc' ? 'desc' : 'asc';
    onSortChange(columnId, newDirection);
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full caption-bottom text-sm">
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
                    <td key={column.id} className="h-12 px-4">
                      <Skeleton className="h-4 w-[60%]" />
                    </td>
                  ))}
                </tr>
              ))
            : table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="h-12 px-4 align-middle">
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
