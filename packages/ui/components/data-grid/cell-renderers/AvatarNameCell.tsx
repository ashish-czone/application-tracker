import type { CellRendererProps } from './types';

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-teal-100 text-teal-700',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase() || '?';
}

export function AvatarNameCell({ value }: CellRendererProps) {
  const name = typeof value === 'string' && value ? value : '-';
  if (name === '-') return <span className="text-sm text-muted-foreground">-</span>;

  const initials = getInitials(name);
  const colorClass = AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length];

  return (
    <div className="flex items-center gap-2.5">
      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${colorClass}`}>
        {initials}
      </div>
      <span className="text-sm font-medium text-foreground truncate">{name}</span>
    </div>
  );
}
