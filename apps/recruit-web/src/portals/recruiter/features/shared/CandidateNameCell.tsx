function getInitials(firstName: unknown, lastName: unknown): string {
  const f = typeof firstName === 'string' ? firstName.charAt(0) : '';
  const l = typeof lastName === 'string' ? lastName.charAt(0) : '';
  return (f + l).toUpperCase() || '?';
}

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

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function CandidateNameCell({ value, row }: { value: unknown; row: Record<string, unknown>; entityType: string }) {
  const firstName = row.firstName as string ?? '';
  const lastName = row.lastName as string ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || String(value ?? '-');
  const initials = getInitials(firstName, lastName);
  const colorClass = getColorFromName(fullName);

  return (
    <div className="flex items-center gap-2.5">
      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${colorClass}`}>
        {initials}
      </div>
      <span className="text-sm font-medium text-foreground truncate">{fullName}</span>
    </div>
  );
}
