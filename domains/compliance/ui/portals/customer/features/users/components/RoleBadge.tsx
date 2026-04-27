export interface RoleBadgeProps {
  name: string;
}

export function RoleBadge({ name }: RoleBadgeProps) {
  return (
    <span className="inline-flex items-center px-2 py-[2px] border border-rule text-[10px] font-sans font-medium text-ink-soft bg-paper-raised whitespace-nowrap">
      {name}
    </span>
  );
}
