import type { ComponentType } from 'react';
import type { CellRendererProps } from './types';

export interface StatusColors {
  bg: string;
  text: string;
  dot: string;
}

const BADGE_PALETTES: StatusColors[] = [
  { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
];

const DEFAULT_COLORS: StatusColors = { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

function formatStatusLabel(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function createStatusBadgeCell(
  colorMap?: Record<string, StatusColors>,
): ComponentType<CellRendererProps> {
  return function StatusBadgeCell({ value }: CellRendererProps) {
    if (!value || typeof value !== 'string') return <span className="text-sm text-muted-foreground">-</span>;

    const colors = colorMap?.[value] ?? BADGE_PALETTES[hashString(value) % BADGE_PALETTES.length];

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
        {formatStatusLabel(value)}
      </span>
    );
  };
}

export const StatusBadgeCell = createStatusBadgeCell();
