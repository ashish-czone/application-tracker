import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { cn } from '../../lib/utils';

interface DataGridExportProps<TData> {
  table: Table<TData>;
  filename?: string;
}

function getExportData<TData>(table: Table<TData>): { headers: string[]; rows: string[][] } {
  const visibleColumns = table
    .getVisibleLeafColumns()
    .filter((col) => col.id !== '_select' && col.id !== 'actions');

  const headers = visibleColumns.map((col) => {
    const header = col.columnDef.header;
    return typeof header === 'string' ? header : col.id;
  });

  const rows = table.getRowModel().rows.map((row) =>
    visibleColumns.map((col) => {
      const cell = row.getAllCells().find((c) => c.column.id === col.id);
      if (!cell) return '';
      const value = cell.getValue();
      if (value == null) return '';
      if (value instanceof Date) return value.toISOString();
      return String(value);
    }),
  );

  return { headers, rows };
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DataGridExport<TData>({
  table,
  filename = 'export',
}: DataGridExportProps<TData>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleExportCsv = () => {
    const { headers, rows } = getExportData(table);
    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    ].join('\n');
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
    setMenuOpen(false);
  };

  const handleExportJson = () => {
    const { headers, rows } = getExportData(table);
    const jsonData = rows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
    downloadFile(JSON.stringify(jsonData, null, 2), `${filename}.json`, 'application/json');
    setMenuOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors',
          menuOpen && 'bg-accent text-accent-foreground',
        )}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
          >
            Export as CSV
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
          >
            Export as JSON
          </button>
        </div>
      )}
    </div>
  );
}
